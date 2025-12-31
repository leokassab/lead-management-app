// Sequence Types for Automatic Lead Sequences

// Action types for sequence steps
export type SequenceActionType = 'call' | 'email' | 'sms' | 'whatsapp' | 'linkedin' | 'task'

// Stop conditions that will stop the sequence for a lead
export type StopCondition = 'replied' | 'meeting_scheduled' | 'do_not_contact' | 'converted' | 'unsubscribed'

// Template types
export type TemplateType = 'email' | 'sms' | 'whatsapp' | 'linkedin'

// Available variables for template personalization
export type TemplateVariable =
  | 'first_name'
  | 'last_name'
  | 'full_name'
  | 'company_name'
  | 'job_title'
  | 'product_interest'
  | 'email'
  | 'phone'
  | 'city'
  | 'country'

// Step conditions
export interface StepConditions {
  only_if_no_response?: boolean
  skip_weekends?: boolean
  only_business_hours?: boolean
  min_score?: number
  max_score?: number
  required_status?: string[]
}

// Action configuration
export interface ActionConfig {
  template_id?: string
  message?: string
  subject?: string
  task_description?: string
  call_script_id?: string
}

// Sequence step definition
export interface SequenceStep {
  order: number
  delay_days: number
  delay_hours: number
  action_type: SequenceActionType
  action_config: ActionConfig
  conditions?: StepConditions
  name?: string
}

// Auto-enrollment rules
export interface AutoEnrollRule {
  field: string
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'greater_than' | 'less_than' | 'in'
  value: string | number | string[]
}

export interface AutoEnrollRules {
  enabled: boolean
  match_type: 'all' | 'any'
  rules: AutoEnrollRule[]
}

// Main Sequence interface
export interface Sequence {
  id: string
  team_id: string
  name: string
  description?: string
  steps: SequenceStep[]
  stop_conditions: StopCondition[]
  auto_enroll_rules?: AutoEnrollRules
  total_enrolled: number
  total_completed: number
  total_converted: number
  active: boolean
  created_at: string
  updated_at: string
}

// Lead sequence status
export type LeadSequenceStatus = 'active' | 'paused' | 'completed' | 'stopped' | 'converted'

// Completed step tracking
export interface CompletedStep {
  step_order: number
  completed_at: string
  action_type: SequenceActionType
  result?: 'success' | 'failed' | 'skipped'
  notes?: string
}

// Lead-Sequence relationship
export interface LeadSequence {
  id: string
  lead_id: string
  sequence_id: string
  current_step: number
  status: LeadSequenceStatus
  started_at: string
  next_step_at?: string
  completed_at?: string
  stopped_reason?: string
  steps_completed: CompletedStep[]
  created_at: string

  // Joined data
  sequence?: Sequence
  lead?: {
    id: string
    full_name?: string
    first_name?: string
    last_name?: string
    email?: string
    company_name?: string
  }
}

// Sequence template
export interface SequenceTemplate {
  id: string
  team_id: string
  name: string
  type: TemplateType
  subject?: string
  content: string
  available_variables: TemplateVariable[]
  created_at: string
  updated_at: string
}

// Form types for creating/editing
export interface SequenceFormData {
  name: string
  description?: string
  steps: SequenceStep[]
  stop_conditions: StopCondition[]
  auto_enroll_rules?: AutoEnrollRules
  active: boolean
}

export interface TemplateFormData {
  name: string
  type: TemplateType
  subject?: string
  content: string
}

// Sequence statistics
export interface SequenceStats {
  total_enrolled: number
  total_active: number
  total_completed: number
  total_converted: number
  total_stopped: number
  conversion_rate: number
  completion_rate: number
  avg_steps_before_conversion: number
}

// Helper to create a new step with defaults
export function createDefaultStep(order: number): SequenceStep {
  return {
    order,
    delay_days: order === 1 ? 0 : 1,
    delay_hours: 0,
    action_type: 'email',
    action_config: {},
  }
}

// Default stop conditions
export const DEFAULT_STOP_CONDITIONS: StopCondition[] = [
  'replied',
  'meeting_scheduled',
  'do_not_contact',
]

// Action type labels (French)
export const ACTION_TYPE_LABELS: Record<SequenceActionType, { label: string; icon: string }> = {
  call: { label: 'Appel', icon: '📞' },
  email: { label: 'Email', icon: '📧' },
  sms: { label: 'SMS', icon: '📱' },
  whatsapp: { label: 'WhatsApp', icon: '💬' },
  linkedin: { label: 'LinkedIn', icon: '💼' },
  task: { label: 'Tâche', icon: '✅' },
}

// Status labels (French)
export const LEAD_SEQUENCE_STATUS_LABELS: Record<LeadSequenceStatus, { label: string; color: string }> = {
  active: { label: 'En cours', color: 'bg-green-100 text-green-700' },
  paused: { label: 'En pause', color: 'bg-yellow-100 text-yellow-700' },
  completed: { label: 'Terminée', color: 'bg-blue-100 text-blue-700' },
  stopped: { label: 'Arrêtée', color: 'bg-red-100 text-red-700' },
  converted: { label: 'Converti', color: 'bg-purple-100 text-purple-700' },
}

// Template variable labels (French)
export const TEMPLATE_VARIABLE_LABELS: Record<TemplateVariable, string> = {
  first_name: 'Prénom',
  last_name: 'Nom',
  full_name: 'Nom complet',
  company_name: 'Entreprise',
  job_title: 'Poste',
  product_interest: 'Intérêt produit',
  email: 'Email',
  phone: 'Téléphone',
  city: 'Ville',
  country: 'Pays',
}
