import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Sequence, SequenceFormData } from '../types/sequences'

export function useSequences() {
  const { profile } = useAuthStore()
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSequences = useCallback(async () => {
    if (!profile?.team_id) return

    setLoading(true)
    setError(null)

    try {
      const { data, error: fetchError } = await supabase
        .from('sequences')
        .select('*')
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })

      if (fetchError) throw fetchError

      setSequences(data || [])
    } catch (err) {
      console.error('Error fetching sequences:', err)
      setError('Erreur lors du chargement des séquences')
    } finally {
      setLoading(false)
    }
  }, [profile?.team_id])

  useEffect(() => {
    fetchSequences()
  }, [fetchSequences])

  const createSequence = async (data: SequenceFormData): Promise<Sequence | null> => {
    if (!profile?.team_id) return null

    try {
      const { data: newSequence, error } = await supabase
        .from('sequences')
        .insert({
          ...data,
          team_id: profile.team_id,
        })
        .select()
        .single()

      if (error) throw error

      setSequences(prev => [newSequence, ...prev])
      return newSequence
    } catch (err) {
      console.error('Error creating sequence:', err)
      setError('Erreur lors de la création de la séquence')
      return null
    }
  }

  const updateSequence = async (id: string, data: Partial<SequenceFormData>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('sequences')
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)

      if (error) throw error

      setSequences(prev =>
        prev.map(seq => (seq.id === id ? { ...seq, ...data, updated_at: new Date().toISOString() } : seq))
      )
      return true
    } catch (err) {
      console.error('Error updating sequence:', err)
      setError('Erreur lors de la mise à jour de la séquence')
      return false
    }
  }

  const toggleSequenceActive = async (id: string, active: boolean): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('sequences')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', id)

      if (error) throw error

      setSequences(prev =>
        prev.map(seq => (seq.id === id ? { ...seq, active } : seq))
      )
      return true
    } catch (err) {
      console.error('Error toggling sequence:', err)
      return false
    }
  }

  const duplicateSequence = async (sequence: Sequence): Promise<Sequence | null> => {
    if (!profile?.team_id) return null

    try {
      const { data: newSequence, error } = await supabase
        .from('sequences')
        .insert({
          team_id: profile.team_id,
          name: `${sequence.name} (copie)`,
          description: sequence.description,
          steps: sequence.steps,
          stop_conditions: sequence.stop_conditions,
          auto_enroll_rules: sequence.auto_enroll_rules,
          active: false,
        })
        .select()
        .single()

      if (error) throw error

      setSequences(prev => [newSequence, ...prev])
      return newSequence
    } catch (err) {
      console.error('Error duplicating sequence:', err)
      setError('Erreur lors de la duplication de la séquence')
      return null
    }
  }

  const deleteSequence = async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('sequences')
        .delete()
        .eq('id', id)

      if (error) throw error

      setSequences(prev => prev.filter(seq => seq.id !== id))
      return true
    } catch (err) {
      console.error('Error deleting sequence:', err)
      setError('Erreur lors de la suppression de la séquence')
      return false
    }
  }

  return {
    sequences,
    loading,
    error,
    fetchSequences,
    createSequence,
    updateSequence,
    toggleSequenceActive,
    duplicateSequence,
    deleteSequence,
  }
}

// Hook to get a single sequence by ID
export function useSequence(id: string | undefined) {
  const [sequence, setSequence] = useState<Sequence | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setLoading(false)
      return
    }

    const fetchSequence = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('sequences')
          .select('*')
          .eq('id', id)
          .single()

        if (fetchError) throw fetchError

        setSequence(data)
      } catch (err) {
        console.error('Error fetching sequence:', err)
        setError('Séquence non trouvée')
      } finally {
        setLoading(false)
      }
    }

    fetchSequence()
  }, [id])

  return { sequence, loading, error, setSequence }
}
