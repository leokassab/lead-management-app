import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type {
  SLATracking,
  SLAStatsByUser,
  SLAStatsBySource,
  SLAOverviewStats,
} from '../types/sla'

export function useSLATracking() {
  const { profile } = useAuthStore()
  const [slaRecords, setSLARecords] = useState<SLATracking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSLARecords = useCallback(async () => {
    if (!profile?.team_id) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('sla_tracking')
        .select(`
          *,
          lead:leads(id, full_name, company_name, source),
          user:users(id, first_name, last_name, avatar_url)
        `)
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setSLARecords(data || [])
    } catch (err) {
      console.error('Error fetching SLA records:', err)
      setError('Erreur lors du chargement des SLA')
    } finally {
      setLoading(false)
    }
  }, [profile?.team_id])

  useEffect(() => {
    fetchSLARecords()
  }, [fetchSLARecords])

  // Check and update breached SLAs
  const checkBreachedSLAs = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc('check_breached_slas')
      if (error) throw error
      if (data > 0) {
        fetchSLARecords()
      }
      return data
    } catch (err) {
      console.error('Error checking breached SLAs:', err)
      return 0
    }
  }, [fetchSLARecords])

  // Mark first contact for a lead
  const markFirstContact = useCallback(async (leadId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ first_contact_at: new Date().toISOString() })
        .eq('id', leadId)

      if (error) throw error

      // Refresh SLA records
      fetchSLARecords()
      return true
    } catch (err) {
      console.error('Error marking first contact:', err)
      return false
    }
  }, [fetchSLARecords])

  // Get pending SLAs for current user
  const pendingSLAs = useMemo(() => {
    if (!profile?.id) return []
    return slaRecords.filter(
      sla => sla.user_id === profile.id && sla.status === 'pending'
    )
  }, [slaRecords, profile?.id])

  // Get breached SLAs
  const breachedSLAs = useMemo(() => {
    return slaRecords.filter(sla => sla.status === 'breached')
  }, [slaRecords])

  return {
    slaRecords,
    pendingSLAs,
    breachedSLAs,
    loading,
    error,
    fetchSLARecords,
    checkBreachedSLAs,
    markFirstContact,
  }
}

// Hook for SLA statistics
export function useSLAStats() {
  const { profile } = useAuthStore()
  const [loading, setLoading] = useState(true)

  // Fetch all data needed for stats
  const [slaRecords, setSLARecords] = useState<SLATracking[]>([])
  const [leads, setLeads] = useState<Array<{
    id: string
    source: string | null
    first_contact_at: string | null
    created_at: string
    assigned_to: string | null
  }>>([])

  useEffect(() => {
    if (!profile?.team_id) return

    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch SLA records
        const { data: slaData } = await supabase
          .from('sla_tracking')
          .select('*')
          .eq('team_id', profile.team_id)

        // Fetch leads with first_contact_at
        const { data: leadsData } = await supabase
          .from('leads')
          .select('id, source, first_contact_at, created_at, assigned_to')
          .eq('team_id', profile.team_id)

        setSLARecords(slaData || [])
        setLeads(leadsData || [])
      } catch (err) {
        console.error('Error fetching SLA stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [profile?.team_id])

  // Calculate overview stats
  const overviewStats: SLAOverviewStats = useMemo(() => {
    const totalSLA = slaRecords.length
    const slaMet = slaRecords.filter(s => s.status === 'met').length
    const slaBreached = slaRecords.filter(s => s.status === 'breached').length
    const slaPending = slaRecords.filter(s => s.status === 'pending').length

    const completedSLAs = slaRecords.filter(s => s.completed_at)
    const responseTimes = completedSLAs.map(s => {
      const created = new Date(s.created_at).getTime()
      const completed = new Date(s.completed_at!).getTime()
      return (completed - created) / (1000 * 60 * 60) // hours
    })

    const avgFirstContactHours = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      : 0

    const sortedTimes = [...responseTimes].sort((a, b) => a - b)
    const medianFirstContactHours = sortedTimes.length > 0
      ? sortedTimes[Math.floor(sortedTimes.length / 2)]
      : 0

    const decidedSLAs = slaMet + slaBreached
    const slaMetPercentage = decidedSLAs > 0
      ? (slaMet / decidedSLAs) * 100
      : 0

    return {
      totalSLA,
      slaMet,
      slaBreached,
      slaPending,
      slaMetPercentage,
      avgFirstContactHours,
      medianFirstContactHours,
      leadsWithBreachedSLA: slaBreached,
    }
  }, [slaRecords])

  // Calculate stats by user
  const statsByUser: SLAStatsByUser[] = useMemo(() => {
    const userMap = new Map<string, {
      user_id: string
      first_name: string
      last_name: string
      records: SLATracking[]
    }>()

    slaRecords.forEach(sla => {
      if (!userMap.has(sla.user_id)) {
        userMap.set(sla.user_id, {
          user_id: sla.user_id,
          first_name: '',
          last_name: '',
          records: [],
        })
      }
      userMap.get(sla.user_id)!.records.push(sla)
    })

    return Array.from(userMap.values()).map(userData => {
      const { records } = userData
      const slaMet = records.filter(r => r.status === 'met').length
      const slaBreached = records.filter(r => r.status === 'breached').length
      const slaPending = records.filter(r => r.status === 'pending').length

      const completedRecords = records.filter(r => r.completed_at)
      const responseTimes = completedRecords.map(r => {
        const created = new Date(r.created_at).getTime()
        const completed = new Date(r.completed_at!).getTime()
        return (completed - created) / (1000 * 60 * 60)
      })

      const avg = responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : null

      const sorted = [...responseTimes].sort((a, b) => a - b)
      const median = sorted.length > 0
        ? sorted[Math.floor(sorted.length / 2)]
        : null

      const decidedCount = slaMet + slaBreached

      return {
        user_id: userData.user_id,
        team_id: records[0]?.team_id || '',
        first_name: userData.first_name,
        last_name: userData.last_name,
        total_sla: records.length,
        sla_met: slaMet,
        sla_breached: slaBreached,
        sla_pending: slaPending,
        sla_met_percentage: decidedCount > 0 ? (slaMet / decidedCount) * 100 : null,
        avg_response_hours: avg,
        median_response_hours: median,
      }
    })
  }, [slaRecords])

  // Calculate stats by source
  const statsBySource: SLAStatsBySource[] = useMemo(() => {
    const sourceMap = new Map<string, {
      source: string
      leads: typeof leads
      slaRecords: SLATracking[]
    }>()

    leads.forEach(lead => {
      const source = lead.source || 'Non défini'
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { source, leads: [], slaRecords: [] })
      }
      sourceMap.get(source)!.leads.push(lead)
    })

    slaRecords.forEach(sla => {
      const lead = leads.find(l => l.id === sla.lead_id)
      const source = lead?.source || 'Non défini'
      if (sourceMap.has(source)) {
        sourceMap.get(source)!.slaRecords.push(sla)
      }
    })

    return Array.from(sourceMap.values())
      .map(data => {
        const { source, leads: sourceLeads, slaRecords: sourceSLAs } = data

        const slaMet = sourceSLAs.filter(s => s.status === 'met').length
        const slaBreached = sourceSLAs.filter(s => s.status === 'breached').length

        // Calculate avg response time from leads with first_contact_at
        const responseTimes = sourceLeads
          .filter(l => l.first_contact_at)
          .map(l => {
            const created = new Date(l.created_at).getTime()
            const contacted = new Date(l.first_contact_at!).getTime()
            return (contacted - created) / (1000 * 60 * 60)
          })

        const avg = responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : null

        const sorted = [...responseTimes].sort((a, b) => a - b)
        const median = sorted.length > 0
          ? sorted[Math.floor(sorted.length / 2)]
          : null

        const decidedCount = slaMet + slaBreached

        return {
          source,
          total_leads: sourceLeads.length,
          avg_response_hours: avg,
          median_response_hours: median,
          sla_met: slaMet,
          sla_breached: slaBreached,
          sla_met_percentage: decidedCount > 0 ? (slaMet / decidedCount) * 100 : null,
        }
      })
      .filter(s => s.total_leads > 0)
      .sort((a, b) => b.total_leads - a.total_leads)
  }, [leads, slaRecords])

  return {
    overviewStats,
    statsByUser,
    statsBySource,
    loading,
  }
}

// Hook to get SLA settings
export function useSLASettings() {
  const { profile } = useAuthStore()
  const [teamSLA, setTeamSLA] = useState<number>(24)
  const [personalSLA, setPersonalSLA] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile?.team_id) return

    const fetchSettings = async () => {
      setLoading(true)
      try {
        // Fetch team SLA
        const { data: teamData } = await supabase
          .from('teams')
          .select('default_sla_hours')
          .eq('id', profile.team_id)
          .single()

        if (teamData) {
          setTeamSLA(teamData.default_sla_hours || 24)
        }

        // Fetch personal SLA
        const { data: userData } = await supabase
          .from('users')
          .select('personal_sla_hours')
          .eq('id', profile.id)
          .single()

        if (userData) {
          setPersonalSLA(userData.personal_sla_hours)
        }
      } catch (err) {
        console.error('Error fetching SLA settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [profile])

  const updateTeamSLA = async (hours: number) => {
    if (!profile?.team_id) return false

    try {
      const { error } = await supabase
        .from('teams')
        .update({ default_sla_hours: hours })
        .eq('id', profile.team_id)

      if (error) throw error

      setTeamSLA(hours)
      return true
    } catch (err) {
      console.error('Error updating team SLA:', err)
      return false
    }
  }

  const updatePersonalSLA = async (hours: number | null) => {
    if (!profile?.id) return false

    try {
      const { error } = await supabase
        .from('users')
        .update({ personal_sla_hours: hours })
        .eq('id', profile.id)

      if (error) throw error

      setPersonalSLA(hours)
      return true
    } catch (err) {
      console.error('Error updating personal SLA:', err)
      return false
    }
  }

  const effectiveSLA = personalSLA ?? teamSLA

  return {
    teamSLA,
    personalSLA,
    effectiveSLA,
    loading,
    updateTeamSLA,
    updatePersonalSLA,
  }
}
