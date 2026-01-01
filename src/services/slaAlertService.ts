import { supabase } from '../lib/supabase'

export interface SLAAlert {
  sla_id: string
  alert_type: 'warning' | 'breach'
  lead_id: string
  user_id: string
  team_id: string
  lead_name: string
  time_remaining: string
  percentage_elapsed: number
}

export interface SLATeamAlert {
  sla_id: string
  lead_id: string
  user_id: string
  team_id: string
  sla_type: string
  sla_deadline: string
  status: string
  warning_sent: boolean
  breach_sent: boolean
  created_at: string
  lead_name: string
  lead_email: string
  lead_phone: string
  user_first_name: string
  user_last_name: string
  user_email: string
  user_avatar: string | null
  alert_status: 'ok' | 'warning' | 'breached'
  time_remaining: string
  percentage_elapsed: number
}

// Check for SLA alerts that need to be sent
export async function checkSLAAlerts(): Promise<SLAAlert[]> {
  try {
    const { data, error } = await supabase.rpc('check_sla_alerts')

    if (error) throw error

    return (data || []).filter((alert: SLAAlert) => alert.alert_type !== null)
  } catch (error) {
    console.error('Error checking SLA alerts:', error)
    return []
  }
}

// Create notification for SLA alert
export async function createSLANotification(
  alert: SLAAlert,
  managerId?: string
): Promise<boolean> {
  try {
    const notifications = []

    // Notification for the commercial
    if (alert.alert_type === 'warning') {
      notifications.push({
        user_id: alert.user_id,
        type: 'sla_warning',
        lead_id: alert.lead_id,
        message: `SLA dans ${formatTimeRemaining(alert.time_remaining)} pour ${alert.lead_name}`,
        read: false,
        action_url: `/leads/${alert.lead_id}`,
      })
    } else if (alert.alert_type === 'breach') {
      // Notification for commercial
      notifications.push({
        user_id: alert.user_id,
        type: 'sla_breach',
        lead_id: alert.lead_id,
        message: `SLA depassepour ${alert.lead_name}`,
        read: false,
        action_url: `/leads/${alert.lead_id}`,
      })

      // Notification for manager if provided
      if (managerId) {
        notifications.push({
          user_id: managerId,
          type: 'sla_breach',
          lead_id: alert.lead_id,
          message: `SLA depasse: ${alert.lead_name} (commercial a contacter)`,
          read: false,
          action_url: `/leads/${alert.lead_id}`,
        })
      }
    }

    if (notifications.length > 0) {
      const { error } = await supabase.from('notifications').insert(notifications)
      if (error) throw error
    }

    // Mark alert as sent
    await markAlertSent(alert.sla_id, alert.alert_type)

    return true
  } catch (error) {
    console.error('Error creating SLA notification:', error)
    return false
  }
}

// Mark SLA alert as sent
export async function markAlertSent(
  slaId: string,
  alertType: 'warning' | 'breach'
): Promise<boolean> {
  try {
    const { error } = await supabase.rpc('mark_sla_alert_sent', {
      p_sla_id: slaId,
      p_alert_type: alertType,
    })

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error marking SLA alert as sent:', error)
    return false
  }
}

// Get team SLA alerts for managers dashboard
export async function getTeamSLAAlerts(teamId: string): Promise<SLATeamAlert[]> {
  try {
    const { data, error } = await supabase
      .from('sla_team_alerts')
      .select('*')
      .eq('team_id', teamId)
      .in('alert_status', ['warning', 'breached'])
      .order('percentage_elapsed', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching team SLA alerts:', error)
    return []
  }
}

// Get managers for a team
export async function getTeamManagers(teamId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('team_id', teamId)
      .in('role', ['manager', 'admin'])

    if (error) throw error
    return (data || []).map(u => u.id)
  } catch (error) {
    console.error('Error fetching team managers:', error)
    return []
  }
}

// Process all pending SLA alerts
export async function processSLAAlerts(): Promise<{ processed: number; errors: number }> {
  const alerts = await checkSLAAlerts()
  let processed = 0
  let errors = 0

  for (const alert of alerts) {
    // Get managers for breach notifications
    let managerId: string | undefined
    if (alert.alert_type === 'breach') {
      const managers = await getTeamManagers(alert.team_id)
      managerId = managers[0] // Send to first manager
    }

    const success = await createSLANotification(alert, managerId)
    if (success) {
      processed++
    } else {
      errors++
    }
  }

  return { processed, errors }
}

// Format time remaining for display
function formatTimeRemaining(timeRemaining: string): string {
  // timeRemaining is in PostgreSQL interval format like "-01:30:00" or "02:15:00"
  if (!timeRemaining) return 'N/A'

  const isNegative = timeRemaining.startsWith('-')
  const cleanTime = timeRemaining.replace('-', '')
  const parts = cleanTime.split(':')

  if (parts.length < 2) return timeRemaining

  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)

  if (isNegative) {
    if (hours > 0) return `depasse de ${hours}h${minutes > 0 ? `${minutes}min` : ''}`
    return `depasse de ${minutes}min`
  }

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}j ${remainingHours}h`
  }

  if (hours > 0) return `${hours}h${minutes > 0 ? `${minutes}min` : ''}`
  return `${minutes}min`
}

// Calculate SLA status from deadline
export function calculateSLAStatus(
  createdAt: string,
  deadline: string
): { status: 'ok' | 'warning' | 'breached'; percentage: number; timeRemaining: string } {
  const now = new Date()
  const created = new Date(createdAt)
  const deadlineDate = new Date(deadline)

  const totalDuration = deadlineDate.getTime() - created.getTime()
  const elapsed = now.getTime() - created.getTime()
  const percentage = Math.round((elapsed / totalDuration) * 100)

  const remaining = deadlineDate.getTime() - now.getTime()
  const remainingHours = Math.floor(remaining / (1000 * 60 * 60))
  const remainingMinutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))

  let timeRemaining: string
  if (remaining < 0) {
    const absHours = Math.abs(remainingHours)
    const absMinutes = Math.abs(remainingMinutes)
    timeRemaining = `depasse de ${absHours > 0 ? `${absHours}h` : ''}${absMinutes}min`
  } else if (remainingHours > 24) {
    const days = Math.floor(remainingHours / 24)
    timeRemaining = `${days}j ${remainingHours % 24}h`
  } else {
    timeRemaining = `${remainingHours}h${remainingMinutes}min`
  }

  let status: 'ok' | 'warning' | 'breached'
  if (percentage >= 100) {
    status = 'breached'
  } else if (percentage >= 80) {
    status = 'warning'
  } else {
    status = 'ok'
  }

  return { status, percentage: Math.min(percentage, 100), timeRemaining }
}
