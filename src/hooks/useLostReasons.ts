import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { LostReason } from '../types'
import { DEFAULT_LOST_REASONS } from '../types'

export function useLostReasons() {
  const { profile } = useAuthStore()
  const [lostReasons, setLostReasons] = useState<LostReason[]>([])
  const [loading, setLoading] = useState(true)

  const fetchLostReasons = useCallback(async () => {
    if (!profile?.team_id) return

    try {
      const { data, error } = await supabase
        .from('lost_reasons')
        .select('*')
        .eq('team_id', profile.team_id)
        .eq('is_active', true)
        .order('order_position')

      if (error) throw error

      if (data && data.length > 0) {
        setLostReasons(data)
      } else {
        // If no reasons in DB, use default reasons as fallback
        // This handles the case before migration is run
        setLostReasons(DEFAULT_LOST_REASONS.map((name, index) => ({
          id: `default-${index}`,
          team_id: profile.team_id,
          name,
          order_position: index + 1,
          is_active: true,
          created_at: new Date().toISOString(),
        })))
      }
    } catch (error) {
      console.error('Error fetching lost reasons:', error)
      // Fallback to default reasons on error
      setLostReasons(DEFAULT_LOST_REASONS.map((name, index) => ({
        id: `default-${index}`,
        team_id: profile?.team_id || '',
        name,
        order_position: index + 1,
        is_active: true,
        created_at: new Date().toISOString(),
      })))
    } finally {
      setLoading(false)
    }
  }, [profile?.team_id])

  useEffect(() => {
    fetchLostReasons()
  }, [fetchLostReasons])

  return {
    lostReasons,
    loading,
    refetch: fetchLostReasons,
  }
}

// Helper function to check if a status is a "lost" status
export function isLostStatus(statusName: string): boolean {
  const lostStatusNames = ['perdu', 'lost', 'cancelled', 'annulé']
  return lostStatusNames.some(name =>
    statusName.toLowerCase().includes(name)
  )
}
