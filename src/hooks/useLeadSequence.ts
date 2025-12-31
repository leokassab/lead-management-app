import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { LeadSequence, Sequence } from '../types/sequences'

export function useLeadSequence(leadId: string | undefined) {
  const { profile } = useAuthStore()
  const [leadSequence, setLeadSequence] = useState<LeadSequence | null>(null)
  const [availableSequences, setAvailableSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeadSequence = useCallback(async () => {
    if (!leadId) return

    setLoading(true)
    setError(null)

    try {
      // Fetch active sequence for this lead
      const { data, error: fetchError } = await supabase
        .from('lead_sequences')
        .select(`
          *,
          sequence:sequences(*)
        `)
        .eq('lead_id', leadId)
        .in('status', ['active', 'paused'])
        .single()

      if (fetchError && fetchError.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is OK
        throw fetchError
      }

      setLeadSequence(data || null)
    } catch (err) {
      console.error('Error fetching lead sequence:', err)
      setError('Erreur lors du chargement de la séquence')
    } finally {
      setLoading(false)
    }
  }, [leadId])

  const fetchAvailableSequences = useCallback(async () => {
    if (!profile?.team_id) return

    try {
      const { data, error: fetchError } = await supabase
        .from('sequences')
        .select('*')
        .eq('team_id', profile.team_id)
        .eq('active', true)
        .order('name')

      if (fetchError) throw fetchError

      setAvailableSequences(data || [])
    } catch (err) {
      console.error('Error fetching available sequences:', err)
    }
  }, [profile?.team_id])

  useEffect(() => {
    fetchLeadSequence()
    fetchAvailableSequences()
  }, [fetchLeadSequence, fetchAvailableSequences])

  // Enroll lead in sequence
  const enrollLeadInSequence = async (sequenceId: string): Promise<boolean> => {
    if (!leadId || !profile?.id) return false

    try {
      // Get the sequence to calculate next_step_at
      const { data: sequence, error: seqError } = await supabase
        .from('sequences')
        .select('*')
        .eq('id', sequenceId)
        .single()

      if (seqError) throw seqError

      // Calculate next_step_at based on first step
      const firstStep = sequence.steps?.[0]
      const delayMs = ((firstStep?.delay_days || 0) * 24 * 60 + (firstStep?.delay_hours || 0)) * 60 * 1000
      const nextStepAt = new Date(Date.now() + delayMs).toISOString()

      // Create lead_sequence entry
      const { data: newLeadSeq, error: insertError } = await supabase
        .from('lead_sequences')
        .insert({
          lead_id: leadId,
          sequence_id: sequenceId,
          current_step: 0,
          status: 'active',
          next_step_at: nextStepAt,
          steps_completed: [],
        })
        .select(`
          *,
          sequence:sequences(*)
        `)
        .single()

      if (insertError) throw insertError

      // Increment sequence.total_enrolled
      await supabase.rpc('increment_sequence_enrolled', { seq_id: sequenceId })

      // Create activity
      await supabase.from('activities').insert({
        lead_id: leadId,
        user_id: profile.id,
        activity_type: 'enrolled_in_sequence',
        description: `Inscrit dans la séquence "${sequence.name}"`,
      })

      setLeadSequence(newLeadSeq)
      return true
    } catch (err) {
      console.error('Error enrolling lead in sequence:', err)
      setError('Erreur lors de l\'inscription dans la séquence')
      return false
    }
  }

  // Pause sequence
  const pauseSequence = async (): Promise<boolean> => {
    if (!leadSequence) return false

    try {
      const { error } = await supabase
        .from('lead_sequences')
        .update({ status: 'paused' })
        .eq('id', leadSequence.id)

      if (error) throw error

      // Create activity
      await supabase.from('activities').insert({
        lead_id: leadId,
        user_id: profile?.id,
        activity_type: 'sequence_paused',
        description: `Séquence "${leadSequence.sequence?.name}" mise en pause`,
      })

      setLeadSequence({ ...leadSequence, status: 'paused' })
      return true
    } catch (err) {
      console.error('Error pausing sequence:', err)
      return false
    }
  }

  // Resume sequence
  const resumeSequence = async (): Promise<boolean> => {
    if (!leadSequence) return false

    try {
      const { error } = await supabase
        .from('lead_sequences')
        .update({ status: 'active' })
        .eq('id', leadSequence.id)

      if (error) throw error

      // Create activity
      await supabase.from('activities').insert({
        lead_id: leadId,
        user_id: profile?.id,
        activity_type: 'sequence_resumed',
        description: `Séquence "${leadSequence.sequence?.name}" reprise`,
      })

      setLeadSequence({ ...leadSequence, status: 'active' })
      return true
    } catch (err) {
      console.error('Error resuming sequence:', err)
      return false
    }
  }

  // Stop sequence
  const stopSequence = async (reason?: string): Promise<boolean> => {
    if (!leadSequence) return false

    try {
      const { error } = await supabase
        .from('lead_sequences')
        .update({
          status: 'stopped',
          stopped_reason: reason || 'Arrêté manuellement',
          completed_at: new Date().toISOString(),
        })
        .eq('id', leadSequence.id)

      if (error) throw error

      // Create activity
      await supabase.from('activities').insert({
        lead_id: leadId,
        user_id: profile?.id,
        activity_type: 'sequence_stopped',
        description: `Séquence "${leadSequence.sequence?.name}" arrêtée${reason ? ` - ${reason}` : ''}`,
      })

      setLeadSequence(null)
      return true
    } catch (err) {
      console.error('Error stopping sequence:', err)
      return false
    }
  }

  return {
    leadSequence,
    availableSequences,
    loading,
    error,
    enrollLeadInSequence,
    pauseSequence,
    resumeSequence,
    stopSequence,
    refetch: fetchLeadSequence,
  }
}

// Hook to check if multiple leads are in sequences (for list view)
export function useLeadsInSequences(leadIds: string[]) {
  const [sequenceMap, setSequenceMap] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (leadIds.length === 0) return

    const fetchSequences = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('lead_sequences')
          .select('lead_id')
          .in('lead_id', leadIds)
          .in('status', ['active', 'paused'])

        if (error) throw error

        const map: Record<string, boolean> = {}
        data?.forEach(item => {
          map[item.lead_id] = true
        })
        setSequenceMap(map)
      } catch (err) {
        console.error('Error fetching leads in sequences:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSequences()
  }, [leadIds.join(',')])

  return { sequenceMap, loading }
}
