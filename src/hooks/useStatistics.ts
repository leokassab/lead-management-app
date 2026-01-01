import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Lead, CustomStatus, User } from '../types'

export type Period = 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year'

interface UseStatisticsReturn {
  leads: Lead[]
  statuses: CustomStatus[]
  teamMembers: User[]
  loading: boolean
  period: Period
  setPeriod: (period: Period) => void
  dateRange: { start: Date; end: Date }
}

function getDateRange(period: Period): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date()
  const end = new Date()

  switch (period) {
    case 'today':
      start.setHours(0, 0, 0, 0)
      end.setHours(23, 59, 59, 999)
      break
    case 'week':
      start.setDate(now.getDate() - 7)
      start.setHours(0, 0, 0, 0)
      break
    case 'month':
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
    case 'last_month':
      start.setMonth(now.getMonth() - 1, 1)
      start.setHours(0, 0, 0, 0)
      end.setDate(0) // Last day of previous month
      end.setHours(23, 59, 59, 999)
      break
    case 'quarter': {
      const quarterStart = Math.floor(now.getMonth() / 3) * 3
      start.setMonth(quarterStart, 1)
      start.setHours(0, 0, 0, 0)
      break
    }
    case 'year':
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
  }

  return { start, end }
}

export function useStatistics(): UseStatisticsReturn {
  const { profile } = useAuthStore()
  const [leads, setLeads] = useState<Lead[]>([])
  const [statuses, setStatuses] = useState<CustomStatus[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('month')

  const dateRange = useMemo(() => getDateRange(period), [period])

  useEffect(() => {
    if (!profile?.team_id) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch all leads for the team
        const { data: leadsData } = await supabase
          .from('leads')
          .select('*, assignedUser:users!leads_assigned_to_fkey(*)')
          .eq('team_id', profile.team_id)
          .order('created_at', { ascending: false })

        // Fetch statuses
        const { data: statusData } = await supabase
          .from('custom_statuses')
          .select('*')
          .eq('team_id', profile.team_id)
          .order('order_index')

        // Fetch team members
        const { data: membersData } = await supabase
          .from('users')
          .select('*')
          .eq('team_id', profile.team_id)

        if (leadsData) setLeads(leadsData)
        if (statusData) setStatuses(statusData)
        if (membersData) setTeamMembers(membersData)
      } catch (err) {
        console.error('Error fetching statistics:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile])

  return {
    leads,
    statuses,
    teamMembers,
    loading,
    period,
    setPeriod,
    dateRange,
  }
}

// Calculate statistics from leads
export interface StatsData {
  // Overview KPIs
  totalLeads: number
  newLeads: number
  closings: number
  revenue: number
  avgTicket: number
  conversionRate: number
  avgClosingDays: number
  responseRate: number

  // Comparisons
  leadsChange: number
  closingsChange: number
  revenueChange: number

  // Charts data
  leadsOverTime: { date: string; count: number }[]
  leadsByStatus: { name: string; value: number; color: string }[]
  leadsBySource: { name: string; value: number }[]
  leadsBySector: { name: string; value: number }[]
  leadsByPriority: { name: string; value: number; color: string }[]

  // Team performance
  teamPerformance: {
    user: User
    leads: number
    contacted: number
    closings: number
    revenue: number
    conversionRate: number
  }[]

  // Funnel
  funnel: { stage: string; count: number; percentage: number }[]
}

export function calculateStats(
  leads: Lead[],
  statuses: CustomStatus[],
  teamMembers: User[],
  dateRange: { start: Date; end: Date }
): StatsData {
  const { start, end } = dateRange

  // Filter leads by period
  const periodLeads = leads.filter(lead => {
    const created = new Date(lead.created_at)
    return created >= start && created <= end
  })

  // Previous period for comparison
  const periodDuration = end.getTime() - start.getTime()
  const prevStart = new Date(start.getTime() - periodDuration)
  const prevEnd = new Date(start.getTime() - 1)
  const prevPeriodLeads = leads.filter(lead => {
    const created = new Date(lead.created_at)
    return created >= prevStart && created <= prevEnd
  })

  // Basic KPIs
  const wonStatus = statuses.find(s => s.name === 'Gagné')
  const closings = periodLeads.filter(l => l.status === wonStatus?.name || l.status === 'Gagné')
  const prevClosings = prevPeriodLeads.filter(l => l.status === wonStatus?.name || l.status === 'Gagné')

  const revenue = closings.reduce((sum, l) => sum + (l.deal_value || 0), 0)
  const prevRevenue = prevClosings.reduce((sum, l) => sum + (l.deal_value || 0), 0)

  // Calculate percentage changes
  const leadsChange = prevPeriodLeads.length > 0
    ? ((periodLeads.length - prevPeriodLeads.length) / prevPeriodLeads.length) * 100
    : 0
  const closingsChange = prevClosings.length > 0
    ? ((closings.length - prevClosings.length) / prevClosings.length) * 100
    : 0
  const revenueChange = prevRevenue > 0
    ? ((revenue - prevRevenue) / prevRevenue) * 100
    : 0

  // Leads over time (daily for current period)
  const leadsOverTime: { date: string; count: number }[] = []
  const dayMs = 24 * 60 * 60 * 1000
  const days = Math.ceil((end.getTime() - start.getTime()) / dayMs)
  const groupBy = days > 60 ? 'week' : days > 14 ? 'day' : 'day'

  if (groupBy === 'day') {
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dayStart = new Date(d)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(d)
      dayEnd.setHours(23, 59, 59, 999)

      const count = periodLeads.filter(lead => {
        const created = new Date(lead.created_at)
        return created >= dayStart && created <= dayEnd
      }).length

      leadsOverTime.push({
        date: d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        count,
      })
    }
  } else {
    // Group by week
    let weekStart = new Date(start)
    while (weekStart <= end) {
      const weekEnd = new Date(weekStart.getTime() + 7 * dayMs)
      const count = periodLeads.filter(lead => {
        const created = new Date(lead.created_at)
        return created >= weekStart && created < weekEnd
      }).length

      leadsOverTime.push({
        date: `Sem ${weekStart.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`,
        count,
      })
      weekStart = weekEnd
    }
  }

  // Leads by status
  const leadsByStatus = statuses.map(status => ({
    name: status.name,
    value: periodLeads.filter(l => l.status === status.name).length,
    color: status.color,
  })).filter(s => s.value > 0)

  // Leads by source
  const sourceMap = new Map<string, number>()
  periodLeads.forEach(lead => {
    const source = lead.source || 'Non défini'
    sourceMap.set(source, (sourceMap.get(source) || 0) + 1)
  })
  const leadsBySource = Array.from(sourceMap.entries())
    .map(([name, value]) => ({ name: formatSource(name), value }))
    .sort((a, b) => b.value - a.value)

  // Leads by sector
  const sectorMap = new Map<string, number>()
  periodLeads.forEach(lead => {
    const sector = lead.sector || 'Non défini'
    sectorMap.set(sector, (sectorMap.get(sector) || 0) + 1)
  })
  const leadsBySector = Array.from(sectorMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Leads by priority
  const priorityColors: Record<string, string> = {
    urgent: '#EF4444',
    hot: '#F97316',
    warm: '#22C55E',
    cold: '#9CA3AF',
  }
  const priorityMap = new Map<string, number>()
  periodLeads.forEach(lead => {
    const priority = lead.priority || 'cold'
    priorityMap.set(priority, (priorityMap.get(priority) || 0) + 1)
  })
  const leadsByPriority = Array.from(priorityMap.entries())
    .map(([name, value]) => ({
      name: formatPriority(name),
      value,
      color: priorityColors[name] || '#9CA3AF',
    }))

  // Team performance
  const teamPerformance = teamMembers.map(user => {
    const userLeads = periodLeads.filter(l => l.assigned_to === user.id)
    const userClosings = userLeads.filter(l => l.status === wonStatus?.name || l.status === 'Gagné')
    const userContacted = userLeads.filter(l =>
      l.status !== 'Opt-in' && l.status !== 'new'
    ).length

    return {
      user,
      leads: userLeads.length,
      contacted: userContacted,
      closings: userClosings.length,
      revenue: userClosings.reduce((sum, l) => sum + (l.deal_value || 0), 0),
      conversionRate: userLeads.length > 0
        ? (userClosings.length / userLeads.length) * 100
        : 0,
    }
  }).sort((a, b) => b.closings - a.closings)

  // Funnel
  const funnelStages = [
    { name: 'Opt-in', statuses: ['Opt-in', 'new'] },
    { name: 'Contacté', statuses: ['Contacté'] },
    { name: 'Qualifié', statuses: ['Qualifié'] },
    { name: 'Proposition', statuses: ['Proposition envoyée'] },
    { name: 'Négociation', statuses: ['Négociation'] },
    { name: 'Gagné', statuses: ['Gagné'] },
  ]

  const totalForFunnel = periodLeads.length
  const funnel = funnelStages.map(stage => {
    // Count leads that reached at least this stage (or beyond)
    const stageIndex = funnelStages.indexOf(stage)
    const laterStages = funnelStages.slice(stageIndex).flatMap(s => s.statuses)
    const count = periodLeads.filter(l => laterStages.includes(l.status)).length

    return {
      stage: stage.name,
      count,
      percentage: totalForFunnel > 0 ? (count / totalForFunnel) * 100 : 0,
    }
  })

  // Calculate response rate and avg closing days
  const contactedCount = periodLeads.filter(l =>
    l.status !== 'Opt-in' && l.status !== 'new'
  ).length
  const responseRate = periodLeads.length > 0
    ? (contactedCount / periodLeads.length) * 100
    : 0

  // Avg closing days (simplified - would need activity data for accuracy)
  const avgClosingDays = closings.length > 0
    ? Math.round(
        closings.reduce((sum, lead) => {
          const created = new Date(lead.created_at)
          const updated = new Date(lead.updated_at)
          return sum + (updated.getTime() - created.getTime()) / dayMs
        }, 0) / closings.length
      )
    : 0

  return {
    totalLeads: periodLeads.length,
    newLeads: periodLeads.filter(l => l.status === 'Opt-in' || l.status === 'new').length,
    closings: closings.length,
    revenue,
    avgTicket: closings.length > 0 ? revenue / closings.length : 0,
    conversionRate: periodLeads.length > 0 ? (closings.length / periodLeads.length) * 100 : 0,
    avgClosingDays,
    responseRate,
    leadsChange,
    closingsChange,
    revenueChange,
    leadsOverTime,
    leadsByStatus,
    leadsBySource,
    leadsBySector,
    leadsByPriority,
    teamPerformance,
    funnel,
  }
}

function formatSource(source: string): string {
  const labels: Record<string, string> = {
    manual: 'Saisie manuelle',
    import_csv: 'Import CSV',
    import_excel: 'Import Excel',
    web_form: 'Formulaire web',
    email: 'Email',
    api: 'API',
  }
  return labels[source] || source
}

function formatPriority(priority: string): string {
  const labels: Record<string, string> = {
    urgent: 'Urgent',
    hot: 'Hot',
    warm: 'Warm',
    cold: 'Cold',
  }
  return labels[priority] || priority
}
