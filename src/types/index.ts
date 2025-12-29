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
}

// Leads
export interface Lead {
  id: string
  team_id: string
  assigned_to?: string
  source: 'import_csv' | 'import_excel' | 'email' | 'web_form' | 'api' | 'manual'

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

  // Deal
  deal_value?: number

  // Metadata
  tags: string[]
  custom_fields: Record<string, unknown>
  notes?: string
  last_contacted_at?: string
  next_action?: 'call_back' | 'send_proposal' | 'follow_up' | 'meeting'
  next_action_date?: string

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
  created_at: string
}

// Activities
export interface Activity {
  id: string
  lead_id: string
  user_id: string
  activity_type: 'comment' | 'call' | 'email_sent' | 'email_opened' | 'status_change' | 'assignment' | 'note' | 'meeting_scheduled' | 'closing'
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
  type: 'comment' | 'assignment' | 'status_change' | 'mention' | 'email_reply' | 'reminder'
  lead_id?: string
  message: string
  read: boolean
  action_url?: string
  created_at: string
}

// Scripts
export interface Script {
  id: string
  lead_id: string
  script_type: 'phone_call' | 'email_intro' | 'email_followup' | 'linkedin_message'
  generated_content: string
  personalization_data?: Record<string, unknown>
  generated_at: string
  used: boolean
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
