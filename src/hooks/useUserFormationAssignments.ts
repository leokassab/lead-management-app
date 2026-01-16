import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import {
  checkUserCalendarAvailability,
  getTeamCalendarSettings,
} from '../services/calendarAvailabilityService'
import type { UserFormationAssignment } from '../types'

// Result of finding the best user for lead assignment
export interface AssignmentResult {
  userId: string | null
  reason: string
  skippedUsers?: { userId: string; userName: string; reason: string }[]
}

export function useUserFormationAssignments() {
  const { profile } = useAuthStore()
  const [assignments, setAssignments] = useState<UserFormationAssignment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAssignments = useCallback(async () => {
    if (!profile?.team_id) return

    try {
      const { data, error } = await supabase
        .from('user_formation_assignments')
        .select(`
          *,
          user:users(*),
          formation_type:formation_types(*)
        `)
        .eq('team_id', profile.team_id)
        .order('priority', { ascending: false })

      if (error) throw error

      if (data) {
        setAssignments(data)
      }
    } catch (error) {
      console.error('Error fetching user formation assignments:', error)
      setAssignments([])
    } finally {
      setLoading(false)
    }
  }, [profile?.team_id])

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  const createAssignment = async (data: {
    user_id: string
    formation_type_id: string
    day_of_week: number[] | null
    priority?: number
  }) => {
    if (!profile?.team_id) return null

    try {
      const { data: newAssignment, error } = await supabase
        .from('user_formation_assignments')
        .insert({
          team_id: profile.team_id,
          user_id: data.user_id,
          formation_type_id: data.formation_type_id,
          day_of_week: data.day_of_week,
          priority: data.priority || 0,
          is_active: true,
        })
        .select(`
          *,
          user:users(*),
          formation_type:formation_types(*)
        `)
        .single()

      if (error) throw error

      await fetchAssignments()
      return newAssignment
    } catch (error) {
      console.error('Error creating assignment:', error)
      return null
    }
  }

  const updateAssignment = async (id: string, data: Partial<UserFormationAssignment>) => {
    try {
      const { error } = await supabase
        .from('user_formation_assignments')
        .update(data)
        .eq('id', id)

      if (error) throw error

      await fetchAssignments()
      return true
    } catch (error) {
      console.error('Error updating assignment:', error)
      return false
    }
  }

  const deleteAssignment = async (id: string) => {
    try {
      const { error } = await supabase
        .from('user_formation_assignments')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchAssignments()
      return true
    } catch (error) {
      console.error('Error deleting assignment:', error)
      return false
    }
  }

  const toggleAssignment = async (id: string, isActive: boolean) => {
    return updateAssignment(id, { is_active: isActive })
  }

  // Get assignments for a specific user
  const getAssignmentsForUser = (userId: string) => {
    return assignments.filter(a => a.user_id === userId && a.is_active)
  }

  // Get assignments for a specific formation type
  const getAssignmentsForFormation = (formationTypeId: string) => {
    return assignments.filter(a => a.formation_type_id === formationTypeId && a.is_active)
  }

  return {
    assignments,
    loading,
    refetch: fetchAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    toggleAssignment,
    getAssignmentsForUser,
    getAssignmentsForFormation,
  }
}

/**
 * Find the best user to assign a lead based on formation type, day of week, and calendar availability
 * Returns both the user ID and the reason for assignment
 */
export async function findBestUserForLeadWithReason(
  teamId: string,
  formationTypeId: string | null | undefined
): Promise<AssignmentResult> {
  if (!formationTypeId) {
    return { userId: null, reason: 'Pas de type de formation spécifié' }
  }

  try {
    // Get team's calendar settings
    const calendarSettings = await getTeamCalendarSettings(teamId)

    // Get current day of week (0 = Sunday, 1 = Monday, ...)
    const today = new Date().getDay()

    // Fetch all active assignments for this formation type with user data
    const { data: assignments, error } = await supabase
      .from('user_formation_assignments')
      .select(`
        *,
        user:users(id, first_name, last_name, active_leads_count, google_calendar_connected, outlook_connected)
      `)
      .eq('team_id', teamId)
      .eq('formation_type_id', formationTypeId)
      .eq('is_active', true)
      .order('priority', { ascending: false })

    if (error) throw error

    if (!assignments || assignments.length === 0) {
      return { userId: null, reason: 'Aucune attribution configurée pour cette formation' }
    }

    // Filter assignments that match today's day
    const matchingAssignments = assignments.filter(a => {
      // If day_of_week is null or empty, it means all days
      if (!a.day_of_week || a.day_of_week.length === 0) return true
      return a.day_of_week.includes(today)
    })

    if (matchingAssignments.length === 0) {
      return { userId: null, reason: 'Aucun commercial disponible pour ce jour' }
    }

    // Sort by priority first, then by load
    const sortedAssignments = [...matchingAssignments].sort((a, b) => {
      // Higher priority first
      if (a.priority !== b.priority) return b.priority - a.priority
      // Then by lower load
      const loadA = a.user?.active_leads_count || 0
      const loadB = b.user?.active_leads_count || 0
      return loadA - loadB
    })

    const skippedUsers: { userId: string; userName: string; reason: string }[] = []

    // If calendar check is enabled, verify availability
    if (calendarSettings.checkCalendar) {
      for (const assignment of sortedAssignments) {
        const user = assignment.user
        if (!user) continue

        const userName = `${user.first_name} ${user.last_name}`
        const hasCalendar = user.google_calendar_connected || user.outlook_connected

        // If user has no calendar connected, check based on fallback strategy
        if (!hasCalendar) {
          // User without calendar - assign directly (cannot check availability)
          return {
            userId: assignment.user_id,
            reason: `Assigné à ${userName} (calendrier non connecté)`,
            skippedUsers,
          }
        }

        // Check calendar availability
        const availability = await checkUserCalendarAvailability(assignment.user_id, 2)

        if (availability.available) {
          return {
            userId: assignment.user_id,
            reason: `Assigné à ${userName} (disponible selon calendrier)`,
            skippedUsers,
          }
        } else {
          // User is busy, add to skipped list and continue to next
          skippedUsers.push({
            userId: assignment.user_id,
            userName,
            reason: `Occupé jusqu'à ${availability.busyUntil ? new Date(availability.busyUntil).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : 'inconnu'}`,
          })
        }
      }

      // No one is available, apply fallback strategy
      switch (calendarSettings.fallbackStrategy) {
        case 'next_available':
          // Find the user who will be available soonest (for now, just pick first)
          if (sortedAssignments.length > 0) {
            const fallbackUser = sortedAssignments[0].user
            const fallbackName = fallbackUser ? `${fallbackUser.first_name} ${fallbackUser.last_name}` : 'Commercial'
            return {
              userId: sortedAssignments[0].user_id,
              reason: `Assigné à ${fallbackName} (prochain disponible - tous occupés)`,
              skippedUsers,
            }
          }
          break

        case 'round_robin':
          // Fall back to round-robin (lowest load)
          if (sortedAssignments.length > 0) {
            const rrUser = sortedAssignments[0].user
            const rrName = rrUser ? `${rrUser.first_name} ${rrUser.last_name}` : 'Commercial'
            return {
              userId: sortedAssignments[0].user_id,
              reason: `Assigné à ${rrName} (round-robin - tous occupés)`,
              skippedUsers,
            }
          }
          break

        case 'manual':
          // Leave unassigned for manual assignment
          return {
            userId: null,
            reason: 'Non assigné (tous les commerciaux sont occupés)',
            skippedUsers,
          }
      }
    }

    // Calendar check disabled - use standard assignment
    if (sortedAssignments.length > 0) {
      const selectedUser = sortedAssignments[0].user
      const selectedName = selectedUser ? `${selectedUser.first_name} ${selectedUser.last_name}` : 'Commercial'
      return {
        userId: sortedAssignments[0].user_id,
        reason: `Assigné à ${selectedName}`,
        skippedUsers,
      }
    }

    return { userId: null, reason: 'Aucun commercial disponible' }
  } catch (error) {
    console.error('Error finding best user for lead:', error)
    return { userId: null, reason: 'Erreur lors de la recherche du commercial' }
  }
}

/**
 * Find the best user to assign a lead based on formation type and day of week
 * Simple version that returns just the user ID (for backward compatibility)
 */
export async function findBestUserForLead(
  teamId: string,
  formationTypeId: string | null | undefined
): Promise<string | null> {
  const result = await findBestUserForLeadWithReason(teamId, formationTypeId)
  return result.userId
}
