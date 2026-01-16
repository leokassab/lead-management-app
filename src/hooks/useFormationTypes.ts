import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { FormationType } from '../types'

export function useFormationTypes() {
  const { profile } = useAuthStore()
  const [formationTypes, setFormationTypes] = useState<FormationType[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFormationTypes = useCallback(async () => {
    if (!profile?.team_id) return

    try {
      const { data, error } = await supabase
        .from('formation_types')
        .select('*')
        .eq('team_id', profile.team_id)
        .order('order_position')

      if (error) throw error

      if (data) {
        setFormationTypes(data)
      }
    } catch (error) {
      console.error('Error fetching formation types:', error)
      setFormationTypes([])
    } finally {
      setLoading(false)
    }
  }, [profile?.team_id])

  useEffect(() => {
    fetchFormationTypes()
  }, [fetchFormationTypes])

  const createFormationType = async (data: Omit<FormationType, 'id' | 'team_id' | 'created_at'>) => {
    if (!profile?.team_id) return null

    try {
      const { data: newType, error } = await supabase
        .from('formation_types')
        .insert({
          ...data,
          team_id: profile.team_id,
        })
        .select()
        .single()

      if (error) throw error

      await fetchFormationTypes()
      return newType
    } catch (error) {
      console.error('Error creating formation type:', error)
      return null
    }
  }

  const updateFormationType = async (id: string, data: Partial<FormationType>) => {
    try {
      const { error } = await supabase
        .from('formation_types')
        .update(data)
        .eq('id', id)

      if (error) throw error

      await fetchFormationTypes()
      return true
    } catch (error) {
      console.error('Error updating formation type:', error)
      return false
    }
  }

  const deleteFormationType = async (id: string) => {
    try {
      const { error } = await supabase
        .from('formation_types')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchFormationTypes()
      return true
    } catch (error) {
      console.error('Error deleting formation type:', error)
      return false
    }
  }

  const reorderFormationTypes = async (orderedIds: string[]) => {
    try {
      const updates = orderedIds.map((id, index) => ({
        id,
        order_position: index,
      }))

      for (const update of updates) {
        await supabase
          .from('formation_types')
          .update({ order_position: update.order_position })
          .eq('id', update.id)
      }

      await fetchFormationTypes()
      return true
    } catch (error) {
      console.error('Error reordering formation types:', error)
      return false
    }
  }

  // Get only active formation types (for dropdowns)
  const activeFormationTypes = formationTypes.filter(ft => ft.is_active)

  return {
    formationTypes,
    activeFormationTypes,
    loading,
    refetch: fetchFormationTypes,
    createFormationType,
    updateFormationType,
    deleteFormationType,
    reorderFormationTypes,
  }
}

// Helper to get formation type by ID
export function getFormationTypeById(formationTypes: FormationType[], id: string | undefined): FormationType | undefined {
  if (!id) return undefined
  return formationTypes.find(ft => ft.id === id)
}
