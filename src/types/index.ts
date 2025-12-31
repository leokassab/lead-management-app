// User & Auth
export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: 'admin' | 'manager' | 'sales'
  team_id: string
  avatar_url?: string
  timezone: string
  performance_score: number
  active_leads_count: number
  created_at: string
  last_login?: string
}

export interface Team {
  id: string
  name: string
  company_name?: string
  subscription_plan: 'free' | 'starter' | 'pro' | 'enterprise'
  subscription_status: 'active' | 'trial' | 'canceled' | 'expired'
  max_leads: number
  current_lead_count: number
  created_at: string
  owner_id: string
  ai_config?: AIConfig
}

// AI Configuration
export interface AIConfig {
  auto_scoring: boolean
  auto_action_recommendation: boolean
  auto_enrichment: boolean
  auto_script_generation: boolean
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  auto_scoring: true,
  auto_action_recommendation: false,
  auto_enrichment: false,
  auto_script_generation: false,
}

// AI Analysis Log
export interface AIAnalysisLog {
  id: string
  lead_id: string
  analysis_type: 'initial_scoring' | 'rescore' | 'action_recommendation' | 'enrichment'
  input_data: Record<string, unknown>
  output_data: Record<string, unknown>
  reasoning?: string
  confidence?: number
  model_used: string
  tokens_used?: number
  processing_time_ms?: number
  created_at: string
}

// AI History Entry (stored in lead.ai_history)
export interface AIHistoryEntry {
  date: string
  type: 'scoring' | 'action' | 'enrichment'
  score?: number
  priority?: string
  action?: string
  reasoning?: string
}

// Lead Actions - What to DO with the lead
export type LeadAction =
  | 'call_today'
  | 'send_email'
  | 'send_whatsapp'
  | 'send_sms'
  | 'follow_up'
  | 'waiting_response'
  | 'schedule_meeting'
  | 'meeting_scheduled'
  | 'send_proposal'
  | 'negotiate'
  | 'do_not_contact'
  | 'none'

export interface LeadActionConfig {
  value: LeadAction
  label: string
  icon: string
  color: string
  bgColor: string
}

export const LEAD_ACTIONS: LeadActionConfig[] = [
  { value: 'call_today', label: 'Appeler aujourd\'hui', icon: '📞', color: 'text-green-700', bgColor: 'bg-green-100' },
  { value: 'send_email', label: 'Envoyer email', icon: '📧', color: 'text-blue-700', bgColor: 'bg-blue-100' },
  { value: 'send_whatsapp', label: 'WhatsApp', icon: '💬', color: 'text-emerald-700', bgColor: 'bg-emerald-100' },
  { value: 'send_sms', label: 'SMS', icon: '📱', color: 'text-purple-700', bgColor: 'bg-purple-100' },
  { value: 'follow_up', label: 'Relancer', icon: '🔁', color: 'text-orange-700', bgColor: 'bg-orange-100' },
  { value: 'waiting_response', label: 'Attente retour', icon: '⏳', color: 'text-yellow-700', bgColor: 'bg-yellow-100' },
  { value: 'schedule_meeting', label: 'Planifier RDV', icon: '📆', color: 'text-indigo-700', bgColor: 'bg-indigo-100' },
  { value: 'meeting_scheduled', label: 'RDV planifié', icon: '✅', color: 'text-teal-700', bgColor: 'bg-teal-100' },
  { value: 'send_proposal', label: 'Envoyer devis', icon: '📄', color: 'text-cyan-700', bgColor: 'bg-cyan-100' },
  { value: 'negotiate', label: 'Négociation', icon: '💰', color: 'text-amber-700', bgColor: 'bg-amber-100' },
  { value: 'do_not_contact', label: 'Ne plus contacter', icon: '❌', color: 'text-red-700', bgColor: 'bg-red-100' },
  { value: 'none', label: 'Aucune action', icon: '➖', color: 'text-gray-500', bgColor: 'bg-gray-100' },
]

export function getActionConfig(action: LeadAction | undefined | null): LeadActionConfig {
  return LEAD_ACTIONS.find(a => a.value === action) || LEAD_ACTIONS[LEAD_ACTIONS.length - 1]
}

// Leads
export interface Lead {
  id: string
  team_id: string
  assigned_to?: string
  source: 'import_csv' | 'import_excel' | 'email' | 'web_form' | 'api' | 'manual'
  source_campaign?: string // Ex: "Meta - Formation Guitare"
  product_interest?: string // Ex: "Formation Guitare niveau débutant"

  // Basic info
  first_name?: string
  last_name?: string
  full_name?: string
  email?: string
  phone?: string
  company_name?: string
  job_title?: string
  linkedin_url?: string
  website?: string

  // Location
  city?: string
  country?: string

  // Classification
  sector?: string
  company_size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+'
  lead_type?: 'B2B' | 'B2C'
  is_decision_maker: boolean

  // Scoring & Qualification
  ai_score?: number
  priority: 'cold' | 'warm' | 'hot' | 'urgent'
  status: string
  maturity_level?: 'awareness' | 'consideration' | 'decision'
  conversion_probability?: number

  // AI Enrichment
  ai_analyzed: boolean
  ai_recommendations?: string
  ai_objections?: AIObjection[]
  ai_reasoning?: string
  ai_analysis_date?: string
  ai_history?: AIHistoryEntry[]
  ai_recommended_action?: LeadAction

  // Deal
  deal_value?: number

  // Actions - What to DO with the lead (distinct from status)
  current_action?: LeadAction
  current_action_date?: string
  current_action_note?: string

  // Legacy action fields (to be deprecated)
  next_action?: 'call_back' | 'send_proposal' | 'follow_up' | 'meeting'
  next_action_date?: string

  // Lost tracking
  lost_reason?: string
  lost_reason_details?: string
  lost_at?: string

  // Metadata
  tags: string[]
  custom_fields: Record<string, unknown>
  notes?: string
  last_contacted_at?: string

  // Enrichment data
  email_validated?: boolean
  email_validation_date?: string
  email_type?: 'professional' | 'personal' | 'disposable' | 'unknown'
  phone_validated?: boolean
  phone_validation_date?: string
  phone_type?: 'mobile' | 'landline' | 'voip' | 'unknown'
  enriched_at?: string

  created_at: string
  updated_at: string

  // Joined data
  assignedUser?: User
}

export interface AIObjection {
  objection: string
  response: string
}

// Custom Statuses
export interface CustomStatus {
  id: string
  team_id: string
  name: string
  color: string
  order_position: number
  is_active: boolean
  is_lost?: boolean
  created_at: string
}

// Lost Reasons
export interface LostReason {
  id: string
  team_id: string
  name: string
  order_position: number
  is_active: boolean
  created_at: string
}

export const DEFAULT_LOST_REASONS = [
  'Pas de budget',
  'Pas le bon timing',
  'Concurrent choisi',
  'Pas de réponse (NRP)',
  'Mauvais numéro/email',
  'Pas intéressé',
  'Doublon',
  'Hors cible',
  'Autre',
]

// Activities
export interface Activity {
  id: string
  lead_id: string
  user_id: string
  activity_type: 'comment' | 'call' | 'email_sent' | 'email_opened' | 'status_change' | 'assignment' | 'note' | 'meeting_scheduled' | 'closing' | 'action_change'
  description?: string
  comment_text?: string
  mentioned_users?: string[]
  attachments?: Attachment[]
  metadata?: Record<string, unknown>
  created_at: string

  // Joined data
  user?: User
}

export interface Attachment {
  url: string
  name: string
  type: string
  size: number
}

// Notifications
export interface Notification {
  id: string
  user_id: string
  type: 'comment' | 'assignment' | 'status_change' | 'mention' | 'email_reply' | 'reminder' | 'action_due'
  lead_id?: string
  message: string
  read: boolean
  action_url?: string
  created_at: string
}

// Scripts
export interface ScriptGenerationContext {
  source?: string
  campaign?: string
  product_interest?: string
  maturity?: string
  objections_addressed?: string[]
  lead_type?: string
  recent_activities?: string[]
}

export interface Script {
  id: string
  lead_id: string
  script_type: 'phone_call' | 'email_intro' | 'email_followup' | 'linkedin_message'
  generated_content: string
  personalization_data?: Record<string, unknown>
  generation_context?: ScriptGenerationContext
  generated_at: string
  used: boolean
  used_at?: string
  effectiveness_rating?: number // 1-5 stars
}

// Assignment Rules
export interface AssignmentRule {
  id: string
  team_id: string
  name: string
  priority: number
  active: boolean
  rule_type: 'keyword' | 'sector' | 'company_size' | 'tag' | 'round_robin' | 'ai_based'
  conditions: Record<string, unknown>
  assign_to_user_id?: string
  add_tags?: string[]
  set_priority?: string
  notify_via?: ('email' | 'in_app' | 'slack')[]
  created_at: string
}

// Performance Profile
export interface UserPerformanceProfile {
  id: string
  user_id: string
  top_sectors: Record<string, number>
  top_company_sizes: Record<string, number>
  top_locations: Record<string, number>
  overall_conversion_rate: number
  conversion_by_sector: Record<string, number>
  average_time_to_close?: number
  response_time_avg?: number
  current_workload: number
  max_capacity: number
  last_updated: string
}
