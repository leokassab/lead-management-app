import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Lead, CustomStatus } from '../types'

interface UseLeadsOptions {
  period?: string
}

interface UseLeadsReturn {
  leads: Lead[]
  statuses: CustomStatus[]
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useLeads(options: UseLeadsOptions = {}): UseLeadsReturn {
  const { period = 'month' } = options
  const [leads, setLeads] = useState<Lead[]>([])
  const [statuses, setStatuses] = useState<CustomStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { profile } = useAuthStore()

  const fetchLeads = useCallback(async () => {
    if (!profile?.team_id) return

    setLoading(true)
    setError(null)

    try {
      // Calculate date range based on period
      const now = new Date()
      let startDate: Date

      switch (period) {
        case 'today':
          startDate = new Date(now)
          startDate.setHours(0, 0, 0, 0)
          break
        case 'week':
          startDate = new Date(now)
          startDate.setDate(now.getDate() - 7)
          break
        case 'last_month':
          startDate = new Date(now)
          startDate.setMonth(now.getMonth() - 1)
          startDate.setDate(1)
          break
        case 'month':
        default:
          startDate = new Date(now)
          startDate.setDate(1)
          break
      }

      // Fetch leads
      let query = supabase
        .from('leads')
        .select(`
          *,
          assignedUser:users!leads_assigned_to_fkey(
            id, first_name, last_name, email, avatar_url
          )
        `)
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })

      // Apply role-based filtering
      if (profile.role === 'sales') {
        query = query.eq('assigned_to', profile.id)
      }

      const { data: leadsData, error: leadsError } = await query

      if (leadsError) throw leadsError

      // Fetch custom statuses
      const { data: statusesData, error: statusesError } = await supabase
        .from('custom_statuses')
        .select('*')
        .eq('team_id', profile.team_id)
        .order('order_position')

      if (statusesError) throw statusesError

      setLeads(leadsData || [])
      setStatuses(statusesData || [])
    } catch (err) {
      console.error('Error fetching leads:', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }, [profile, period])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  return {
    leads,
    statuses,
    loading,
    error,
    refetch: fetchLeads,
  }
}

interface DashboardStats {
  totalLeads: number
  actionsCount: number
  conversionRate: number
  urgentLeads: Lead[]
  weekLeads: Lead[]
  standbyLeads: Lead[]
  newCount: number
  contactedCount: number
  inProgressCount: number
  closingsCount: number
}

export function useDashboardStats(leads: Lead[], statuses: CustomStatus[]): DashboardStats {
  const now = new Date()
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(today)
  endOfWeek.setDate(today.getDate() + 7)

  // Find status IDs
  const getStatusByName = (name: string) => statuses.find(s =>
    s.name.toLowerCase() === name.toLowerCase()
  )

  const wonStatus = getStatusByName('Gagné')
  const lostStatus = getStatusByName('Perdu')
  const standbyStatus = getStatusByName('Stand by')
  const contactedStatus = getStatusByName('Contacté')
  const optinStatus = getStatusByName('Opt-in')

  // Calculate counts
  const totalLeads = leads.length

  const closedLeads = leads.filter(l =>
    l.status === wonStatus?.name || l.status === lostStatus?.name
  )
  const wonLeads = leads.filter(l => l.status === wonStatus?.name)
  const conversionRate = closedLeads.length > 0
    ? (wonLeads.length / closedLeads.length) * 100
    : 0

  // Leads requiring action
  const actionsLeads = leads.filter(lead => {
    // Has action scheduled for today or past
    if (lead.next_action_date) {
      const actionDate = new Date(lead.next_action_date)
      if (actionDate <= now) return true
    }
    // New lead not processed
    if (lead.status === optinStatus?.name || lead.status === 'new') return true
    // Not contacted for 7+ days
    if (lead.last_contacted_at) {
      const lastContact = new Date(lead.last_contacted_at)
      const daysSince = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince > 7) return true
    }
    return false
  })

  // Urgent leads (action today or overdue)
  const urgentLeads = leads.filter(lead => {
    if (!lead.next_action_date) return false
    const actionDate = new Date(lead.next_action_date)
    return actionDate <= today || lead.priority === 'urgent'
  }).slice(0, 5)

  // This week leads
  const weekLeads = leads.filter(lead => {
    if (!lead.next_action_date) return false
    const actionDate = new Date(lead.next_action_date)
    return actionDate > today && actionDate <= endOfWeek
  }).slice(0, 5)

  // Standby leads
  const standbyLeads = leads.filter(lead =>
    lead.status === standbyStatus?.name
  ).slice(0, 5)

  // KPI counts
  const newCount = leads.filter(l =>
    l.status === optinStatus?.name || l.status === 'new'
  ).length

  const contactedCount = leads.filter(l =>
    l.status === contactedStatus?.name
  ).length

  const inProgressCount = leads.filter(l =>
    l.status !== optinStatus?.name &&
    l.status !== wonStatus?.name &&
    l.status !== lostStatus?.name &&
    l.status !== 'new'
  ).length

  const closingsCount = wonLeads.length

  return {
    totalLeads,
    actionsCount: actionsLeads.length,
    conversionRate,
    urgentLeads,
    weekLeads,
    standbyLeads,
    newCount,
    contactedCount,
    inProgressCount,
    closingsCount,
  }
}
