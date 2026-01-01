// Meeting Types for Appointment Management

// Meeting type (format)
export type MeetingType = 'call' | 'video' | 'in_person'

// Meeting status
export type MeetingStatus = 'scheduled' | 'confirmed' | 'completed' | 'no_show' | 'cancelled' | 'rescheduled'

// Main Meeting interface
export interface Meeting {
  id: string
  team_id: string
  lead_id: string
  user_id: string

  title: string
  description?: string
  scheduled_at: string
  duration_minutes: number
  type: MeetingType
  location?: string

  status: MeetingStatus

  reminder_24h_sent: boolean
  reminder_1h_sent: boolean
  reminder_email_lead: boolean
  reminder_sms_lead: boolean

  google_event_id?: string
  google_calendar_synced?: boolean
  google_meet_link?: string
  outlook_event_id?: string
  outlook_calendar_synced?: boolean
  outlook_teams_link?: string

  notes?: string
  outcome?: string
  next_steps?: string

  no_show_followup_sent: boolean
  rescheduled_from?: string

  created_at: string
  updated_at: string

  // Joined data
  lead?: {
    id: string
    full_name?: string
    first_name?: string
    last_name?: string
    email?: string
    phone?: string
    company_name?: string
  }
  user?: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
  }
}

// Form data for creating/editing meetings
export interface MeetingFormData {
  lead_id: string
  user_id: string
  title: string
  description?: string
  scheduled_at: string
  duration_minutes: number
  type: MeetingType
  location?: string
  reminder_email_lead?: boolean
  reminder_sms_lead?: boolean
  notes?: string
}

// Form data for completing a meeting
export interface MeetingOutcomeData {
  status: 'completed' | 'no_show'
  outcome?: string
  next_steps?: string
  notes?: string
}

// Meeting type labels (French)
export const MEETING_TYPE_LABELS: Record<MeetingType, { label: string; icon: string }> = {
  call: { label: 'Appel', icon: '📞' },
  video: { label: 'Visio', icon: '🎥' },
  in_person: { label: 'Présentiel', icon: '🤝' },
}

// Meeting status labels (French)
export const MEETING_STATUS_LABELS: Record<MeetingStatus, { label: string; color: string; icon: string }> = {
  scheduled: { label: 'Planifié', color: 'bg-blue-100 text-blue-700', icon: '📅' },
  confirmed: { label: 'Confirmé', color: 'bg-green-100 text-green-700', icon: '✅' },
  completed: { label: 'Terminé', color: 'bg-gray-100 text-gray-700', icon: '✔️' },
  no_show: { label: 'No-show', color: 'bg-red-100 text-red-700', icon: '❌' },
  cancelled: { label: 'Annulé', color: 'bg-gray-100 text-gray-500', icon: '🚫' },
  rescheduled: { label: 'Reporté', color: 'bg-yellow-100 text-yellow-700', icon: '🔄' },
}

// Duration options
export const DURATION_OPTIONS = [
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
]

// Helper to create default meeting form data
export function createDefaultMeetingData(leadId: string, userId: string): MeetingFormData {
  // Default to tomorrow at 10:00
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(10, 0, 0, 0)

  return {
    lead_id: leadId,
    user_id: userId,
    title: 'RDV',
    scheduled_at: tomorrow.toISOString().slice(0, 16),
    duration_minutes: 30,
    type: 'call',
    reminder_email_lead: true,
    reminder_sms_lead: false,
  }
}

// Helper to format meeting time range
export function formatMeetingTimeRange(scheduledAt: string, durationMinutes: number): string {
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  return `${formatTime(start)} - ${formatTime(end)}`
}

// Helper to check if meeting is in the past
export function isMeetingPast(scheduledAt: string): boolean {
  return new Date(scheduledAt) < new Date()
}

// Helper to check if meeting is today
export function isMeetingToday(scheduledAt: string): boolean {
  const meetingDate = new Date(scheduledAt)
  const today = new Date()
  return (
    meetingDate.getFullYear() === today.getFullYear() &&
    meetingDate.getMonth() === today.getMonth() &&
    meetingDate.getDate() === today.getDate()
  )
}
