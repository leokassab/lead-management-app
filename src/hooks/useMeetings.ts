import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Meeting, MeetingFormData, MeetingOutcomeData } from '../types/meetings'

export function useMeetings() {
  const { profile } = useAuthStore()
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMeetings = useCallback(async () => {
    if (!profile?.team_id) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('meetings')
        .select(`
          *,
          lead:leads(id, full_name, first_name, last_name, email, phone, company_name),
          user:users(id, first_name, last_name, email, avatar_url)
        `)
        .eq('team_id', profile.team_id)
        .order('scheduled_at', { ascending: true })

      if (fetchError) throw fetchError

      setMeetings(data || [])
    } catch (err) {
      console.error('Error fetching meetings:', err)
      setError('Erreur lors du chargement des RDV')
    } finally {
      setLoading(false)
    }
  }, [profile?.team_id])

  useEffect(() => {
    fetchMeetings()
  }, [fetchMeetings])

  // Create a new meeting
  const createMeeting = async (data: MeetingFormData): Promise<Meeting | null> => {
    if (!profile?.team_id) return null

    try {
      const { data: newMeeting, error } = await supabase
        .from('meetings')
        .insert({
          ...data,
          team_id: profile.team_id,
        })
        .select(`
          *,
          lead:leads(id, full_name, first_name, last_name, email, phone, company_name),
          user:users(id, first_name, last_name, email, avatar_url)
        `)
        .single()

      if (error) throw error

      // Create activity for the lead
      await supabase.from('activities').insert({
        lead_id: data.lead_id,
        user_id: profile.id,
        activity_type: 'meeting_scheduled',
        description: `RDV planifié: ${data.title}`,
      })

      setMeetings(prev => [...prev, newMeeting].sort(
        (a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
      ))

      return newMeeting
    } catch (err) {
      console.error('Error creating meeting:', err)
      setError('Erreur lors de la création du RDV')
      return null
    }
  }

  // Update a meeting
  const updateMeeting = async (id: string, data: Partial<MeetingFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      setMeetings(prev =>
        prev.map(m => (m.id === id ? { ...m, ...data, updated_at: new Date().toISOString() } : m))
      )

      return true
    } catch (err) {
      console.error('Error updating meeting:', err)
      setError('Erreur lors de la mise à jour du RDV')
      return false
    }
  }

  // Complete a meeting (set outcome)
  const completeMeeting = async (id: string, data: MeetingOutcomeData): Promise<boolean> => {
    try {
      const meeting = meetings.find(m => m.id === id)
      if (!meeting) return false

      const { error } = await supabase
        .from('meetings')
        .update({
          status: data.status,
          outcome: data.outcome,
          next_steps: data.next_steps,
          notes: data.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      // Create activity
      const activityType = data.status === 'completed' ? 'meeting_completed' : 'meeting_no_show'
      await supabase.from('activities').insert({
        lead_id: meeting.lead_id,
        user_id: profile?.id,
        activity_type: activityType,
        description: data.status === 'completed'
          ? `RDV terminé: ${meeting.title}${data.outcome ? ` - ${data.outcome}` : ''}`
          : `No-show: ${meeting.title}`,
      })

      setMeetings(prev =>
        prev.map(m => (m.id === id ? { ...m, ...data, updated_at: new Date().toISOString() } : m))
      )

      return true
    } catch (err) {
      console.error('Error completing meeting:', err)
      setError('Erreur lors de la mise à jour du RDV')
      return false
    }
  }

  // Cancel a meeting
  const cancelMeeting = async (id: string, reason?: string): Promise<boolean> => {
    try {
      const meeting = meetings.find(m => m.id === id)
      if (!meeting) return false

      const { error } = await supabase
        .from('meetings')
        .update({
          status: 'cancelled',
          notes: reason ? `Annulé: ${reason}` : meeting.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      // Create activity
      await supabase.from('activities').insert({
        lead_id: meeting.lead_id,
        user_id: profile?.id,
        activity_type: 'meeting_cancelled',
        description: `RDV annulé: ${meeting.title}${reason ? ` - ${reason}` : ''}`,
      })

      setMeetings(prev =>
        prev.map(m => (m.id === id ? { ...m, status: 'cancelled', updated_at: new Date().toISOString() } : m))
      )

      return true
    } catch (err) {
      console.error('Error cancelling meeting:', err)
      return false
    }
  }

  // Reschedule a meeting
  const rescheduleMeeting = async (id: string, newScheduledAt: string): Promise<Meeting | null> => {
    try {
      const meeting = meetings.find(m => m.id === id)
      if (!meeting || !profile?.team_id) return null

      // Mark old meeting as rescheduled
      await supabase
        .from('meetings')
        .update({
          status: 'rescheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      // Create new meeting
      const { data: newMeeting, error } = await supabase
        .from('meetings')
        .insert({
          team_id: profile.team_id,
          lead_id: meeting.lead_id,
          user_id: meeting.user_id,
          title: meeting.title,
          description: meeting.description,
          scheduled_at: newScheduledAt,
          duration_minutes: meeting.duration_minutes,
          type: meeting.type,
          location: meeting.location,
          reminder_email_lead: meeting.reminder_email_lead,
          reminder_sms_lead: meeting.reminder_sms_lead,
          notes: meeting.notes,
          rescheduled_from: id,
        })
        .select(`
          *,
          lead:leads(id, full_name, first_name, last_name, email, phone, company_name),
          user:users(id, first_name, last_name, email, avatar_url)
        `)
        .single()

      if (error) throw error

      // Create activity
      await supabase.from('activities').insert({
        lead_id: meeting.lead_id,
        user_id: profile.id,
        activity_type: 'meeting_rescheduled',
        description: `RDV reporté: ${meeting.title}`,
      })

      // Update local state
      setMeetings(prev => [
        ...prev.map(m => (m.id === id ? { ...m, status: 'rescheduled' as const } : m)),
        newMeeting,
      ].sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()))

      return newMeeting
    } catch (err) {
      console.error('Error rescheduling meeting:', err)
      setError('Erreur lors du report du RDV')
      return null
    }
  }

  // Delete a meeting
  const deleteMeeting = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', id)

      if (error) throw error

      setMeetings(prev => prev.filter(m => m.id !== id))
      return true
    } catch (err) {
      console.error('Error deleting meeting:', err)
      setError('Erreur lors de la suppression du RDV')
      return false
    }
  }

  // Get upcoming meetings (scheduled or confirmed, in the future)
  const upcomingMeetings = meetings.filter(m =>
    (m.status === 'scheduled' || m.status === 'confirmed') &&
    new Date(m.scheduled_at) >= new Date()
  )

  // Get today's meetings
  const todayMeetings = meetings.filter(m => {
    const meetingDate = new Date(m.scheduled_at)
    const today = new Date()
    return (
      meetingDate.getFullYear() === today.getFullYear() &&
      meetingDate.getMonth() === today.getMonth() &&
      meetingDate.getDate() === today.getDate() &&
      (m.status === 'scheduled' || m.status === 'confirmed')
    )
  })

  return {
    meetings,
    upcomingMeetings,
    todayMeetings,
    loading,
    error,
    fetchMeetings,
    createMeeting,
    updateMeeting,
    completeMeeting,
    cancelMeeting,
    rescheduleMeeting,
    deleteMeeting,
  }
}

// Hook for getting meetings for a specific lead
export function useLeadMeetings(leadId: string | undefined) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!leadId) {
      setLoading(false)
      return
    }

    const fetchLeadMeetings = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select(`
            *,
            user:users(id, first_name, last_name, email, avatar_url)
          `)
          .eq('lead_id', leadId)
          .order('scheduled_at', { ascending: false })

        if (error) throw error

        setMeetings(data || [])
      } catch (err) {
        console.error('Error fetching lead meetings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchLeadMeetings()
  }, [leadId])

  return { meetings, loading }
}

// Hook for getting meetings for a specific user
export function useUserMeetings(userId: string | undefined) {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) {
      setLoading(false)
      return
    }

    const fetchUserMeetings = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('meetings')
          .select(`
            *,
            lead:leads(id, full_name, first_name, last_name, email, phone, company_name)
          `)
          .eq('user_id', userId)
          .gte('scheduled_at', new Date().toISOString())
          .in('status', ['scheduled', 'confirmed'])
          .order('scheduled_at', { ascending: true })

        if (error) throw error

        setMeetings(data || [])
      } catch (err) {
        console.error('Error fetching user meetings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUserMeetings()
  }, [userId])

  return { meetings, loading }
}
