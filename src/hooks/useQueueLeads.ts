import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Lead, LeadAction } from '../types'

export type QueueFilter = 'all' | 'call' | 'follow_up' | 'email'

interface QueueStats {
  toCall: number
  toFollowUp: number
  waiting: number
  urgent: number
}

interface UseQueueLeadsReturn {
  leads: Lead[]
  filteredLeads: Lead[]
  stats: QueueStats
  loading: boolean
  error: string | null
  filter: QueueFilter
  setFilter: (filter: QueueFilter) => void
  refetch: () => Promise<void>
  updateLeadAction: (leadId: string, action: LeadAction, date?: string, note?: string) => Promise<void>
}

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  hot: 1,
  warm: 2,
  cold: 3,
}

export function useQueueLeads(): UseQueueLeadsReturn {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<QueueFilter>('all')
  const { profile } = useAuthStore()

  const fetchLeads = useCallback(async () => {
    if (!profile?.id) return

    setLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('leads')
        .select(`
          *,
          assignedUser:users!leads_assigned_to_fkey(
            id, first_name, last_name, email, avatar_url
          )
        `)
        .eq('team_id', profile.team_id)

      // Filter by assigned user (sales see only their leads)
      if (profile.role === 'sales') {
        query = query.eq('assigned_to', profile.id)
      }

      // Exclude closed and inactive leads
      query = query
        .not('status', 'ilike', '%gagné%')
        .not('status', 'ilike', '%perdu%')
        .not('status', 'ilike', '%won%')
        .not('status', 'ilike', '%lost%')
        .not('current_action', 'eq', 'waiting_response')
        .not('current_action', 'eq', 'do_not_contact')

      const { data, error: fetchError } = await query

      if (fetchError) throw fetchError

      // Sort leads by priority, action date, and AI score
      const sortedLeads = (data || []).sort((a, b) => {
        // 1. Priority (urgent first)
        const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)
        if (priorityDiff !== 0) return priorityDiff

        // 2. Action date (today first, then nearest dates)
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

        const dateA = a.current_action_date ? new Date(a.current_action_date) : null
        const dateB = b.current_action_date ? new Date(b.current_action_date) : null

        // Leads with dates come before leads without dates
        if (dateA && !dateB) return -1
        if (!dateA && dateB) return 1

        if (dateA && dateB) {
          // Overdue leads first
          const overdueA = dateA < today
          const overdueB = dateB < today
          if (overdueA && !overdueB) return -1
          if (!overdueA && overdueB) return 1

          // Then sort by date (nearest first)
          const dateDiff = dateA.getTime() - dateB.getTime()
          if (dateDiff !== 0) return dateDiff
        }

        // 3. AI Score (highest first)
        const scoreA = a.ai_score ?? 0
        const scoreB = b.ai_score ?? 0
        return scoreB - scoreA
      })

      setLeads(sortedLeads)
    } catch (err) {
      console.error('Error fetching queue leads:', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Calculate stats
  const stats = useMemo<QueueStats>(() => {
    return {
      toCall: leads.filter(l =>
        l.current_action === 'call_today' ||
        l.current_action === 'schedule_meeting'
      ).length,
      toFollowUp: leads.filter(l =>
        l.current_action === 'follow_up' ||
        l.current_action === 'send_proposal' ||
        l.current_action === 'negotiate'
      ).length,
      waiting: leads.filter(l =>
        l.current_action === 'waiting_response'
      ).length,
      urgent: leads.filter(l =>
        l.priority === 'urgent' ||
        (l.current_action_date && new Date(l.current_action_date) < new Date())
      ).length,
    }
  }, [leads])

  // Filter leads based on selected filter
  const filteredLeads = useMemo(() => {
    switch (filter) {
      case 'call':
        return leads.filter(l =>
          l.current_action === 'call_today' ||
          l.current_action === 'schedule_meeting' ||
          l.current_action === 'meeting_scheduled'
        )
      case 'follow_up':
        return leads.filter(l =>
          l.current_action === 'follow_up' ||
          l.current_action === 'send_proposal' ||
          l.current_action === 'negotiate'
        )
      case 'email':
        return leads.filter(l =>
          l.current_action === 'send_email' ||
          l.current_action === 'send_whatsapp' ||
          l.current_action === 'send_sms'
        )
      default:
        return leads
    }
  }, [leads, filter])

  // Update lead action
  const updateLeadAction = useCallback(async (
    leadId: string,
    action: LeadAction,
    date?: string,
    note?: string
  ) => {
    try {
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          current_action: action,
          current_action_date: date || null,
          current_action_note: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId)

      if (updateError) throw updateError

      // Update local state
      setLeads(prev => prev.map(lead =>
        lead.id === leadId
          ? { ...lead, current_action: action, current_action_date: date, current_action_note: note }
          : lead
      ))
    } catch (err) {
      console.error('Error updating lead action:', err)
      throw err
    }
  }, [])

  return {
    leads,
    filteredLeads,
    stats,
    loading,
    error,
    filter,
    setFilter,
    refetch: fetchLeads,
    updateLeadAction,
  }
}
