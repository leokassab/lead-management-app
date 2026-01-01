import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuthStore } from '../stores/authStore'
import {
  getTeamSLAAlerts,
  processSLAAlerts,
  type SLATeamAlert,
} from '../services/slaAlertService'

// Check interval: every 5 minutes
const CHECK_INTERVAL = 5 * 60 * 1000

export function useSLAAlerts() {
  const { profile } = useAuthStore()
  const [alerts, setAlerts] = useState<SLATeamAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const isManager = profile?.role === 'manager' || profile?.role === 'admin'

  // Fetch team SLA alerts
  const fetchAlerts = useCallback(async () => {
    if (!profile?.team_id) return

    try {
      const data = await getTeamSLAAlerts(profile.team_id)
      setAlerts(data)
      setError(null)
    } catch (err) {
      console.error('Error fetching SLA alerts:', err)
      setError('Erreur lors du chargement des alertes SLA')
    } finally {
      setLoading(false)
    }
  }, [profile?.team_id])

  // Process pending alerts and create notifications
  const checkAndNotify = useCallback(async () => {
    if (!profile?.team_id) return

    try {
      const result = await processSLAAlerts()
      console.log(`SLA alerts processed: ${result.processed}, errors: ${result.errors}`)
      setLastCheck(new Date())

      // Refresh the alerts list
      await fetchAlerts()
    } catch (err) {
      console.error('Error processing SLA alerts:', err)
    }
  }, [profile?.team_id, fetchAlerts])

  // Initial fetch
  useEffect(() => {
    if (profile?.team_id) {
      fetchAlerts()
    }
  }, [profile?.team_id, fetchAlerts])

  // Periodic check for managers/admins
  useEffect(() => {
    if (!isManager || !profile?.team_id) return

    // Initial check
    checkAndNotify()

    // Set up periodic checking
    intervalRef.current = setInterval(checkAndNotify, CHECK_INTERVAL)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isManager, profile?.team_id, checkAndNotify])

  // Get alerts by status
  const warningAlerts = alerts.filter(a => a.alert_status === 'warning')
  const breachedAlerts = alerts.filter(a => a.alert_status === 'breached')

  // Get alerts for a specific user
  const getAlertsForUser = useCallback(
    (userId: string) => alerts.filter(a => a.user_id === userId),
    [alerts]
  )

  // Get count by status
  const alertCounts = {
    total: alerts.length,
    warning: warningAlerts.length,
    breached: breachedAlerts.length,
  }

  return {
    alerts,
    warningAlerts,
    breachedAlerts,
    alertCounts,
    loading,
    error,
    lastCheck,
    isManager,
    fetchAlerts,
    checkAndNotify,
    getAlertsForUser,
  }
}

// Hook for individual user SLA status
export function useUserSLAStatus(userId?: string) {
  const { alerts, loading } = useSLAAlerts()

  const userAlerts = userId ? alerts.filter(a => a.user_id === userId) : []
  const hasWarning = userAlerts.some(a => a.alert_status === 'warning')
  const hasBreach = userAlerts.some(a => a.alert_status === 'breached')

  return {
    userAlerts,
    hasWarning,
    hasBreach,
    loading,
    alertCount: userAlerts.length,
  }
}
