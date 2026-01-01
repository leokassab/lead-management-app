import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'

export interface UserObjectives {
  monthly_lead_target: number
  monthly_closing_target: number
  current_leads: number
  current_closings: number
  lead_progress: number
  closing_progress: number
}

export function useUserObjectives() {
  const { profile } = useAuthStore()
  const [objectives, setObjectives] = useState<UserObjectives | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchObjectives = async () => {
      if (!profile?.id) return

      setLoading(true)
      try {
        // Get user targets
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('monthly_lead_target, monthly_closing_target')
          .eq('id', profile.id)
          .single()

        if (userError) throw userError

        // Get current month's leads count
        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const { count: leadsCount, error: leadsError } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', profile.id)
          .gte('created_at', startOfMonth.toISOString())

        if (leadsError) throw leadsError

        // Get current month's closings count
        const { count: closingsCount, error: closingsError } = await supabase
          .from('leads')
          .select('*', { count: 'exact', head: true })
          .eq('assigned_to', profile.id)
          .eq('status', 'Closing')
          .gte('updated_at', startOfMonth.toISOString())

        if (closingsError) throw closingsError

        const monthlyLeadTarget = userData?.monthly_lead_target || 0
        const monthlyClosingTarget = userData?.monthly_closing_target || 0
        const currentLeads = leadsCount || 0
        const currentClosings = closingsCount || 0

        setObjectives({
          monthly_lead_target: monthlyLeadTarget,
          monthly_closing_target: monthlyClosingTarget,
          current_leads: currentLeads,
          current_closings: currentClosings,
          lead_progress: monthlyLeadTarget > 0 ? Math.round((currentLeads / monthlyLeadTarget) * 100) : 0,
          closing_progress: monthlyClosingTarget > 0 ? Math.round((currentClosings / monthlyClosingTarget) * 100) : 0,
        })
      } catch (err) {
        console.error('Error fetching objectives:', err)
        setError('Erreur lors du chargement des objectifs')
      } finally {
        setLoading(false)
      }
    }

    fetchObjectives()
  }, [profile?.id])

  // Calculate progress color
  const getProgressColor = (progress: number): string => {
    if (progress >= 80) return 'bg-green-500'
    if (progress >= 50) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const getProgressTextColor = (progress: number): string => {
    if (progress >= 80) return 'text-green-600'
    if (progress >= 50) return 'text-orange-600'
    return 'text-red-600'
  }

  // Check if user has objectives set
  const hasObjectives = useMemo(() => {
    return objectives &&
      (objectives.monthly_lead_target > 0 || objectives.monthly_closing_target > 0)
  }, [objectives])

  // Days remaining in month
  const daysRemaining = useMemo(() => {
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    return lastDay.getDate() - now.getDate()
  }, [])

  // Projected completion
  const projectedCompletion = useMemo(() => {
    if (!objectives) return { leads: 0, closings: 0 }

    const now = new Date()
    const dayOfMonth = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

    const dailyLeadRate = objectives.current_leads / dayOfMonth
    const dailyClosingRate = objectives.current_closings / dayOfMonth

    return {
      leads: Math.round(dailyLeadRate * daysInMonth),
      closings: Math.round(dailyClosingRate * daysInMonth),
    }
  }, [objectives])

  return {
    objectives,
    loading,
    error,
    hasObjectives,
    daysRemaining,
    projectedCompletion,
    getProgressColor,
    getProgressTextColor,
  }
}
