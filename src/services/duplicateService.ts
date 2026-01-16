import { supabase } from '../lib/supabase'
import type { Lead } from '../types'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  originalLead?: Lead
  matchingFields: string[]
}

export interface DuplicateInfo {
  originalLeadId: string
  originalLeadName: string
  matchingFields: string[]
  detectedAt: string
}

/**
 * Check if a lead is a duplicate based on email or phone
 */
export async function checkForDuplicate(
  teamId: string,
  email: string | undefined | null,
  phone: string | undefined | null,
  excludeLeadId?: string
): Promise<DuplicateCheckResult> {
  if (!email && !phone) {
    return { isDuplicate: false, matchingFields: [] }
  }

  try {
    // Build query to find matching leads
    let query = supabase
      .from('leads')
      .select('*')
      .eq('team_id', teamId)

    // Exclude the current lead if updating
    if (excludeLeadId) {
      query = query.neq('id', excludeLeadId)
    }

    // Check for email or phone match
    const conditions = []
    if (email) {
      conditions.push(`email.eq.${email}`)
    }
    if (phone) {
      conditions.push(`phone.eq.${phone}`)
    }

    // Use OR condition
    if (conditions.length === 1) {
      if (email) {
        query = query.eq('email', email)
      } else if (phone) {
        query = query.eq('phone', phone)
      }
    } else {
      query = query.or(`email.eq.${email},phone.eq.${phone}`)
    }

    const { data: existingLeads, error } = await query.limit(1)

    if (error) throw error

    if (!existingLeads || existingLeads.length === 0) {
      return { isDuplicate: false, matchingFields: [] }
    }

    const existingLead = existingLeads[0] as Lead
    const matchingFields: string[] = []

    // Check which fields match
    if (email && existingLead.email === email) {
      matchingFields.push('email')
    }
    if (phone && existingLead.phone === phone) {
      matchingFields.push('phone')
    }

    return {
      isDuplicate: true,
      originalLead: existingLead,
      matchingFields,
    }
  } catch (error) {
    console.error('Error checking for duplicate:', error)
    return { isDuplicate: false, matchingFields: [] }
  }
}

/**
 * Normalize phone number for comparison
 */
function normalizePhone(phone: string): string {
  return phone.replace(/\s+/g, '').replace(/[^\d+]/g, '')
}

/**
 * Mark a lead as duplicate and create notification for original lead owner
 */
export async function markAsDuplicate(
  leadId: string,
  originalLeadId: string,
  matchingFields: string[],
  _teamId: string
): Promise<boolean> {
  try {
    // Update the new lead as duplicate
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        is_duplicate: true,
        duplicate_of: originalLeadId,
        duplicate_detected_at: new Date().toISOString(),
        duplicate_fields: matchingFields,
      })
      .eq('id', leadId)

    if (updateError) throw updateError

    // Get the original lead to get assignee and create notification
    const { data: originalLead } = await supabase
      .from('leads')
      .select('assigned_to, full_name, first_name, last_name')
      .eq('id', originalLeadId)
      .single()

    if (originalLead?.assigned_to) {
      // Get the new lead's name
      const { data: newLead } = await supabase
        .from('leads')
        .select('full_name, first_name, last_name')
        .eq('id', leadId)
        .single()

      const newLeadName = newLead?.full_name || `${newLead?.first_name || ''} ${newLead?.last_name || ''}`.trim() || 'Nouveau contact'

      // Create notification for the original lead's owner
      await supabase.from('notifications').insert({
        user_id: originalLead.assigned_to,
        type: 'mention',
        lead_id: originalLeadId,
        message: `🔔 Nouvelle demande de ${newLeadName} - déjà dans votre base`,
        action_url: `/leads/${leadId}`,
      })
    }

    return true
  } catch (error) {
    console.error('Error marking as duplicate:', error)
    return false
  }
}

/**
 * Remove duplicate flag from a lead
 */
export async function markAsNotDuplicate(leadId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('leads')
      .update({
        is_duplicate: false,
        duplicate_of: null,
        duplicate_detected_at: null,
        duplicate_fields: null,
      })
      .eq('id', leadId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error removing duplicate flag:', error)
    return false
  }
}

/**
 * Merge a duplicate lead into the original lead
 * Keeps the original lead, merges data, and deletes the duplicate
 */
export async function mergeDuplicateIntoOriginal(
  duplicateLeadId: string,
  originalLeadId: string,
  userId: string
): Promise<boolean> {
  try {
    // Get both leads
    const { data: leads, error: fetchError } = await supabase
      .from('leads')
      .select('*')
      .in('id', [duplicateLeadId, originalLeadId])

    if (fetchError || !leads || leads.length !== 2) {
      throw new Error('Could not fetch leads for merge')
    }

    const duplicateLead = leads.find(l => l.id === duplicateLeadId) as Lead
    const originalLead = leads.find(l => l.id === originalLeadId) as Lead

    if (!duplicateLead || !originalLead) {
      throw new Error('Could not find both leads')
    }

    // Merge data - take newer non-null values from duplicate
    const mergedData: Partial<Lead> = {}
    const fieldsToMerge = [
      'phone', 'email', 'company_name', 'job_title', 'linkedin_url', 'website',
      'city', 'country', 'sector', 'company_size', 'notes'
    ]

    for (const field of fieldsToMerge) {
      const origValue = (originalLead as unknown as Record<string, unknown>)[field]
      const dupValue = (duplicateLead as unknown as Record<string, unknown>)[field]

      // If original is empty but duplicate has a value, use duplicate's value
      if (!origValue && dupValue) {
        (mergedData as unknown as Record<string, unknown>)[field] = dupValue
      }
    }

    // Append notes if both have notes
    if (originalLead.notes && duplicateLead.notes) {
      mergedData.notes = `${originalLead.notes}\n\n--- Fusionné le ${new Date().toLocaleDateString('fr-FR')} ---\n${duplicateLead.notes}`
    }

    // Update tags - merge unique tags
    const originalTags = originalLead.tags || []
    const duplicateTags = duplicateLead.tags || []
    const mergedTags = [...new Set([...originalTags, ...duplicateTags])]
    if (mergedTags.length > originalTags.length) {
      mergedData.tags = mergedTags
    }

    // Update the original lead with merged data
    if (Object.keys(mergedData).length > 0) {
      mergedData.updated_at = new Date().toISOString()
      await supabase
        .from('leads')
        .update(mergedData)
        .eq('id', originalLeadId)
    }

    // Move activities from duplicate to original
    await supabase
      .from('activities')
      .update({ lead_id: originalLeadId })
      .eq('lead_id', duplicateLeadId)

    // Create activity for the merge
    await supabase.from('activities').insert({
      lead_id: originalLeadId,
      user_id: userId,
      activity_type: 'note',
      description: `Lead fusionné avec un doublon (${duplicateLead.full_name || duplicateLead.email || 'Contact'})`,
    })

    // Delete the duplicate lead
    await supabase
      .from('leads')
      .delete()
      .eq('id', duplicateLeadId)

    return true
  } catch (error) {
    console.error('Error merging duplicate:', error)
    return false
  }
}

/**
 * Get duplicates of a lead (leads that have this lead as duplicate_of)
 */
export async function getDuplicatesOfLead(leadId: string): Promise<Lead[]> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('duplicate_of', leadId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return data as Lead[] || []
  } catch (error) {
    console.error('Error getting duplicates:', error)
    return []
  }
}

/**
 * Get the original lead if this lead is a duplicate
 */
export async function getOriginalLead(duplicateOfId: string): Promise<Lead | null> {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', duplicateOfId)
      .single()

    if (error) throw error
    return data as Lead
  } catch (error) {
    console.error('Error getting original lead:', error)
    return null
  }
}

/**
 * Check multiple leads for duplicates (for batch import)
 */
export async function checkBatchForDuplicates(
  teamId: string,
  leads: Array<{ email?: string; phone?: string; index: number }>
): Promise<Map<number, DuplicateCheckResult>> {
  const results = new Map<number, DuplicateCheckResult>()

  // Get all existing emails and phones in the team
  type PartialLead = Pick<Lead, 'id' | 'email' | 'phone' | 'full_name' | 'first_name' | 'last_name'>

  const { data: existingLeads } = await supabase
    .from('leads')
    .select('id, email, phone, full_name, first_name, last_name')
    .eq('team_id', teamId)

  if (!existingLeads) return results

  const emailMap = new Map<string, PartialLead>()
  const phoneMap = new Map<string, PartialLead>()

  existingLeads.forEach((lead) => {
    const partialLead = lead as PartialLead
    if (partialLead.email) emailMap.set(partialLead.email.toLowerCase(), partialLead)
    if (partialLead.phone) phoneMap.set(normalizePhone(partialLead.phone), partialLead)
  })

  // Also track duplicates within the batch itself
  const batchEmailMap = new Map<string, number>()
  const batchPhoneMap = new Map<string, number>()

  for (const lead of leads) {
    const matchingFields: string[] = []
    let originalLead: PartialLead | undefined

    // Check against existing leads
    if (lead.email) {
      const existing = emailMap.get(lead.email.toLowerCase())
      if (existing) {
        matchingFields.push('email')
        originalLead = existing
      }
    }

    if (lead.phone) {
      const normalized = normalizePhone(lead.phone)
      const existing = phoneMap.get(normalized)
      if (existing) {
        matchingFields.push('phone')
        if (!originalLead) originalLead = existing
      }
    }

    // Check for duplicates within the batch (first occurrence wins)
    if (matchingFields.length === 0) {
      if (lead.email) {
        const emailLower = lead.email.toLowerCase()
        if (batchEmailMap.has(emailLower)) {
          matchingFields.push('email (dans le fichier)')
        } else {
          batchEmailMap.set(emailLower, lead.index)
        }
      }

      if (lead.phone) {
        const normalized = normalizePhone(lead.phone)
        if (batchPhoneMap.has(normalized)) {
          matchingFields.push('phone (dans le fichier)')
        } else {
          batchPhoneMap.set(normalized, lead.index)
        }
      }
    }

    if (matchingFields.length > 0) {
      results.set(lead.index, {
        isDuplicate: true,
        originalLead: originalLead as Lead | undefined,
        matchingFields,
      })
    }
  }

  return results
}
