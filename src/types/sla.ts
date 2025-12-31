// SLA Types for Ticket 19

export type SLAType = 'first_contact' | 'response' | 'follow_up'
export type SLAStatus = 'pending' | 'met' | 'breached'

export interface SLATracking {
  id: string
  lead_id: string
  user_id: string
  team_id: string
  sla_type: SLAType
  sla_deadline: string
  sla_hours: number
  status: SLAStatus
  completed_at: string | null
  created_at: string
  updated_at: string
  // Joined data
  lead?: {
    id: string
    full_name: string
    company_name: string | null
    source: string | null
  }
  user?: {
    id: string
    first_name: string
    last_name: string
    avatar_url: string | null
  }
}

export interface SLAStatsByUser {
  user_id: string
  team_id: string
  first_name: string
  last_name: string
  total_sla: number
  sla_met: number
  sla_breached: number
  sla_pending: number
  sla_met_percentage: number | null
  avg_response_hours: number | null
  median_response_hours: number | null
}

export interface SLAStatsBySource {
  source: string
  total_leads: number
  avg_response_hours: number | null
  median_response_hours: number | null
  sla_met: number
  sla_breached: number
  sla_met_percentage: number | null
}

export interface SLAOverviewStats {
  totalSLA: number
  slaMet: number
  slaBreached: number
  slaPending: number
  slaMetPercentage: number
  avgFirstContactHours: number
  medianFirstContactHours: number
  leadsWithBreachedSLA: number
}

export const SLA_TYPE_LABELS: Record<SLAType, string> = {
  first_contact: 'Premier contact',
  response: 'Réponse',
  follow_up: 'Suivi',
}

export const SLA_STATUS_LABELS: Record<SLAStatus, string> = {
  pending: 'En attente',
  met: 'Respecté',
  breached: 'Dépassé',
}

export const SLA_STATUS_COLORS: Record<SLAStatus, string> = {
  pending: '#F59E0B', // amber
  met: '#10B981', // green
  breached: '#EF4444', // red
}
