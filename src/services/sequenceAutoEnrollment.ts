import { supabase } from '../lib/supabase'
import type { Sequence } from '../types/sequences'

/**
 * Auto-enroll a lead in a sequence based on their formation type.
 * Only enrolls in the first matching active sequence that has:
 * - The lead's formation_type_id in its formation_type_ids array
 * - Is active
 *
 * @param leadId - The lead's ID
 * @param formationTypeId - The lead's formation type ID
 * @param teamId - The team ID
 * @param userId - The user ID (for activity logging)
 */
export async function autoEnrollLeadInSequence(
  leadId: string,
  formationTypeId: string,
  teamId: string,
  userId: string
): Promise<void> {
  try {
    // Check if lead is already in an active sequence
    const { data: existingSequence } = await supabase
      .from('lead_sequences')
      .select('id')
      .eq('lead_id', leadId)
      .in('status', ['active', 'paused'])
      .single()

    if (existingSequence) {
      // Lead is already in a sequence, don't auto-enroll
      return
    }

    // Find sequences that match this formation type
    // We need to filter client-side since Supabase doesn't support array contains easily
    const { data: sequences, error: seqError } = await supabase
      .from('sequences')
      .select('*')
      .eq('team_id', teamId)
      .eq('active', true)
      .order('created_at', { ascending: true })

    if (seqError) throw seqError

    if (!sequences || sequences.length === 0) return

    // Find the first sequence that matches this formation type
    const matchingSequence = sequences.find((seq: Sequence) => {
      if (!seq.formation_type_ids || seq.formation_type_ids.length === 0) {
        return false // Only auto-enroll in sequences with specific formation types
      }
      return seq.formation_type_ids.includes(formationTypeId)
    })

    if (!matchingSequence) return

    // Calculate next_step_at based on first step
    const firstStep = matchingSequence.steps?.[0]
    const delayMs = ((firstStep?.delay_days || 0) * 24 * 60 + (firstStep?.delay_hours || 0)) * 60 * 1000
    const nextStepAt = new Date(Date.now() + delayMs).toISOString()

    // Create lead_sequence entry
    const { error: insertError } = await supabase
      .from('lead_sequences')
      .insert({
        lead_id: leadId,
        sequence_id: matchingSequence.id,
        current_step: 0,
        status: 'active',
        next_step_at: nextStepAt,
        steps_completed: [],
      })

    if (insertError) throw insertError

    // Increment sequence.total_enrolled
    await supabase.rpc('increment_sequence_enrolled', { seq_id: matchingSequence.id })

    // Create activity
    await supabase.from('activities').insert({
      lead_id: leadId,
      user_id: userId,
      activity_type: 'enrolled_in_sequence',
      description: `Auto-inscrit dans la séquence "${matchingSequence.name}" (type de formation)`,
    })

    console.log(`Lead ${leadId} auto-enrolled in sequence ${matchingSequence.name}`)
  } catch (error) {
    console.error('Error in auto-enrollment:', error)
    throw error
  }
}
