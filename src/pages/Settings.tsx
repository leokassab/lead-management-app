import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button, Avatar, Input, Select, Modal, Badge } from '../components/ui'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { getTeamAIConfig, updateTeamAIConfig } from '../services/ai'
import {
  initGoogleAuth,
  handleGoogleCallback,
  disconnectGoogleCalendar,
  isGoogleCalendarConfigured,
} from '../services/googleCalendarService'
import {
  initOutlookAuth,
  handleOutlookCallback,
  disconnectOutlookCalendar,
  isOutlookCalendarConfigured,
} from '../services/outlookCalendarService'
import {
  getTeamCalendarSettings,
  updateTeamCalendarSettings,
} from '../services/calendarAvailabilityService'
import type { CustomStatus, User, AssignmentRule, Team, AIConfig, FormationType, UserFormationAssignment } from '../types'
import { DEFAULT_AI_CONFIG, DAYS_OF_WEEK } from '../types'

type Tab = 'profile' | 'team' | 'statuses' | 'formations' | 'assignments' | 'rules' | 'ai' | 'integrations' | 'billing'

const ROLE_OPTIONS = [
  { value: 'sales', label: 'Commercial' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
]

const RULE_TYPES = [
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'sector', label: 'Par secteur' },
  { value: 'company_size', label: 'Par taille entreprise' },
  { value: 'keyword', label: 'Par mot-clé' },
  { value: 'tag', label: 'Par tag' },
]

const DEFAULT_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

export default function Settings() {
  const { profile, fetchProfile } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get('tab')
    return (tab as Tab) || 'profile'
  })
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([])
  const [formationTypes, setFormationTypes] = useState<FormationType[]>([])
  const [assignmentRules, setAssignmentRules] = useState<AssignmentRule[]>([])
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  // Profile form
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    timezone: 'Europe/Paris',
  })
  const [profileSaving, setProfileSaving] = useState(false)

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [showRuleModal, setShowRuleModal] = useState(false)
  const [editingStatus, setEditingStatus] = useState<CustomStatus | null>(null)
  const [editingRule, setEditingRule] = useState<AssignmentRule | null>(null)

  // Invite form
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'sales' })

  // Status form
  const [statusForm, setStatusForm] = useState({ name: '', color: '#3B82F6' })

  // Formation type modal
  const [showFormationModal, setShowFormationModal] = useState(false)
  const [editingFormation, setEditingFormation] = useState<FormationType | null>(null)

  // Formation type form
  const [formationForm, setFormationForm] = useState({ name: '', color: '#3B82F6', description: '' })

  // User formation assignments
  const [formationAssignments, setFormationAssignments] = useState<UserFormationAssignment[]>([])
  const [showAssignmentModal, setShowAssignmentModal] = useState(false)
  const [editingAssignment, setEditingAssignment] = useState<UserFormationAssignment | null>(null)
  const [assignmentForm, setAssignmentForm] = useState({
    user_id: '',
    formation_type_id: '',
    day_of_week: [] as number[],
    all_days: true,
  })

  // Rule form
  const [ruleForm, setRuleForm] = useState({
    name: '',
    rule_type: 'round_robin',
    assign_to_user_id: '',
    conditions: {} as Record<string, string>,
    priority: 1,
    active: true,
  })

  // API key
  const [apiKey, setApiKey] = useState('')
  const [openaiKey, setOpenaiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)

  // AI Config
  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG)
  const [aiConfigSaving, setAIConfigSaving] = useState(false)

  // Google Calendar
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false)
  const [googleCalendarEmail, setGoogleCalendarEmail] = useState<string | null>(null)
  const [googleConnecting, setGoogleConnecting] = useState(false)

  // Outlook Calendar
  const [outlookConnected, setOutlookConnected] = useState(false)
  const [outlookEmail, setOutlookEmail] = useState<string | null>(null)
  const [outlookConnecting, setOutlookConnecting] = useState(false)

  // Calendar assignment settings
  const [calendarCheckEnabled, setCalendarCheckEnabled] = useState(false)
  const [calendarFallbackStrategy, setCalendarFallbackStrategy] = useState<'next_available' | 'round_robin' | 'manual'>('round_robin')
  const [calendarSettingsSaving, setCalendarSettingsSaving] = useState(false)

  const fetchData = useCallback(async () => {
    if (!profile?.team_id) return

    setLoading(true)
    try {
      const [membersRes, statusesRes, formationsRes, rulesRes, teamRes, assignmentsRes] = await Promise.all([
        supabase
          .from('users')
          .select('*')
          .eq('team_id', profile.team_id),
        supabase
          .from('custom_statuses')
          .select('*')
          .eq('team_id', profile.team_id)
          .order('order_position'),
        supabase
          .from('formation_types')
          .select('*')
          .eq('team_id', profile.team_id)
          .order('order_position'),
        supabase
          .from('assignment_rules')
          .select('*')
          .eq('team_id', profile.team_id)
          .order('priority'),
        supabase
          .from('teams')
          .select('*')
          .eq('id', profile.team_id)
          .single(),
        supabase
          .from('user_formation_assignments')
          .select(`
            *,
            user:users(*),
            formation_type:formation_types(*)
          `)
          .eq('team_id', profile.team_id)
          .order('priority', { ascending: false }),
      ])

      if (membersRes.data) setTeamMembers(membersRes.data)
      if (statusesRes.data) setCustomStatuses(statusesRes.data)
      if (formationsRes.data) setFormationTypes(formationsRes.data)
      if (rulesRes.data) setAssignmentRules(rulesRes.data)
      if (teamRes.data) setTeam(teamRes.data)
      if (assignmentsRes.data) setFormationAssignments(assignmentsRes.data)

      // Fetch AI config
      const config = await getTeamAIConfig(profile.team_id)
      setAIConfig(config)

      // Fetch calendar assignment settings
      const calendarSettings = await getTeamCalendarSettings(profile.team_id)
      setCalendarCheckEnabled(calendarSettings.checkCalendar)
      setCalendarFallbackStrategy(calendarSettings.fallbackStrategy)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    if (profile) {
      setProfileForm({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        email: profile.email || '',
        timezone: 'Europe/Paris',
      })
      if (profile.team_id) {
        fetchData()
      }
    }
  }, [profile, fetchData])

  // Handle OAuth callbacks (Google and Outlook)
  useEffect(() => {
    const code = searchParams.get('code')
    const state = searchParams.get('state')

    if (code && profile?.id) {
      setActiveTab('integrations')

      // Check if this is an Outlook callback (state starts with "outlook_")
      if (state?.startsWith('outlook_')) {
        setOutlookConnecting(true)
        handleOutlookCallback(code, profile.id).then((result) => {
          if (result.success) {
            setOutlookConnected(true)
            setOutlookEmail(result.email || null)
          } else {
            alert(`Erreur de connexion Outlook: ${result.error}`)
          }
          setOutlookConnecting(false)
          setSearchParams({})
        })
      } else {
        // Google callback
        setGoogleConnecting(true)
        handleGoogleCallback(code, profile.id).then((result) => {
          if (result.success) {
            setGoogleCalendarConnected(true)
            setGoogleCalendarEmail(result.email || null)
          } else {
            alert(`Erreur de connexion Google: ${result.error}`)
          }
          setGoogleConnecting(false)
          setSearchParams({})
        })
      }
    }
  }, [searchParams, profile?.id, setSearchParams])

  // Load calendar connection statuses
  useEffect(() => {
    const loadCalendarStatuses = async () => {
      if (!profile?.id) return

      const { data } = await supabase
        .from('users')
        .select('google_calendar_connected, google_calendar_email, outlook_connected, outlook_email')
        .eq('id', profile.id)
        .single()

      if (data) {
        setGoogleCalendarConnected(data.google_calendar_connected || false)
        setGoogleCalendarEmail(data.google_calendar_email || null)
        setOutlookConnected(data.outlook_connected || false)
        setOutlookEmail(data.outlook_email || null)
      }
    }

    loadCalendarStatuses()
  }, [profile?.id])

  // Profile handlers
  const handleSaveProfile = async () => {
    if (!profile) return
    setProfileSaving(true)

    try {
      const { error } = await supabase
        .from('users')
        .update({
          first_name: profileForm.first_name,
          last_name: profileForm.last_name,
        })
        .eq('id', profile.id)

      if (error) throw error
      await fetchProfile(profile.id)
      alert('Profil mis à jour')
    } catch (err) {
      console.error('Error updating profile:', err)
      alert('Erreur lors de la mise à jour')
    } finally {
      setProfileSaving(false)
    }
  }

  // Team handlers
  const handleInviteMember = async () => {
    if (!profile?.team_id || !inviteForm.email) return

    try {
      // In a real app, this would send an invitation email
      // For now, we'll just show a success message
      alert(`Invitation envoyée à ${inviteForm.email}`)
      setShowInviteModal(false)
      setInviteForm({ email: '', role: 'sales' })
    } catch (err) {
      console.error('Error inviting member:', err)
      alert('Erreur lors de l\'invitation')
    }
  }

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', memberId)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error updating role:', err)
      alert('Erreur lors de la mise à jour du rôle')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce membre ?')) return

    try {
      const { error } = await supabase
        .from('users')
        .update({ team_id: null })
        .eq('id', memberId)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error removing member:', err)
      alert('Erreur lors de la suppression')
    }
  }

  const handleUpdateMemberTargets = async (memberId: string, field: 'monthly_lead_target' | 'monthly_closing_target', value: number) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ [field]: value })
        .eq('id', memberId)

      if (error) throw error

      // Update local state
      setTeamMembers(prev =>
        prev.map(m => m.id === memberId ? { ...m, [field]: value } : m)
      )
    } catch (err) {
      console.error('Error updating member targets:', err)
      alert('Erreur lors de la mise à jour')
    }
  }

  // Status handlers
  const handleOpenStatusModal = (status?: CustomStatus | null) => {
    if (status) {
      setEditingStatus(status)
      setStatusForm({ name: status.name, color: status.color })
    } else {
      setEditingStatus(null)
      setStatusForm({ name: '', color: DEFAULT_COLORS[customStatuses.length % DEFAULT_COLORS.length] })
    }
    setShowStatusModal(true)
  }

  const handleSaveStatus = async () => {
    if (!profile?.team_id || !statusForm.name) return

    try {
      if (editingStatus) {
        const { error } = await supabase
          .from('custom_statuses')
          .update({ name: statusForm.name, color: statusForm.color })
          .eq('id', editingStatus.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('custom_statuses')
          .insert({
            team_id: profile.team_id,
            name: statusForm.name,
            color: statusForm.color,
            order_position: customStatuses.length,
            is_active: true,
          })

        if (error) throw error
      }

      fetchData()
      setShowStatusModal(false)
    } catch (err) {
      console.error('Error saving status:', err)
      alert('Erreur lors de l\'enregistrement')
    }
  }

  const handleDeleteStatus = async (statusId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce statut ?')) return

    try {
      const { error } = await supabase
        .from('custom_statuses')
        .delete()
        .eq('id', statusId)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error deleting status:', err)
      alert('Erreur lors de la suppression')
    }
  }

  // Formation type handlers
  const handleOpenFormationModal = (formation?: FormationType | null) => {
    if (formation) {
      setEditingFormation(formation)
      setFormationForm({ name: formation.name, color: formation.color, description: formation.description || '' })
    } else {
      setEditingFormation(null)
      setFormationForm({ name: '', color: DEFAULT_COLORS[formationTypes.length % DEFAULT_COLORS.length], description: '' })
    }
    setShowFormationModal(true)
  }

  const handleSaveFormation = async () => {
    if (!profile?.team_id || !formationForm.name) return

    try {
      if (editingFormation) {
        const { error } = await supabase
          .from('formation_types')
          .update({ name: formationForm.name, color: formationForm.color, description: formationForm.description || null })
          .eq('id', editingFormation.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('formation_types')
          .insert({
            team_id: profile.team_id,
            name: formationForm.name,
            color: formationForm.color,
            description: formationForm.description || null,
            order_position: formationTypes.length,
            is_active: true,
          })

        if (error) throw error
      }

      fetchData()
      setShowFormationModal(false)
    } catch (err) {
      console.error('Error saving formation type:', err)
      alert('Erreur lors de l\'enregistrement')
    }
  }

  const handleDeleteFormation = async (formationId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce type de formation ?')) return

    try {
      const { error } = await supabase
        .from('formation_types')
        .delete()
        .eq('id', formationId)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error deleting formation type:', err)
      alert('Erreur lors de la suppression')
    }
  }

  const handleToggleFormation = async (formation: FormationType) => {
    try {
      const { error } = await supabase
        .from('formation_types')
        .update({ is_active: !formation.is_active })
        .eq('id', formation.id)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error toggling formation type:', err)
    }
  }

  // User formation assignment handlers
  const handleOpenAssignmentModal = (assignment?: UserFormationAssignment | null) => {
    if (assignment) {
      setEditingAssignment(assignment)
      setAssignmentForm({
        user_id: assignment.user_id,
        formation_type_id: assignment.formation_type_id,
        day_of_week: assignment.day_of_week || [],
        all_days: !assignment.day_of_week || assignment.day_of_week.length === 0,
      })
    } else {
      setEditingAssignment(null)
      setAssignmentForm({
        user_id: '',
        formation_type_id: '',
        day_of_week: [],
        all_days: true,
      })
    }
    setShowAssignmentModal(true)
  }

  const handleSaveAssignment = async () => {
    if (!profile?.team_id || !assignmentForm.user_id || !assignmentForm.formation_type_id) return

    try {
      const assignmentData = {
        team_id: profile.team_id,
        user_id: assignmentForm.user_id,
        formation_type_id: assignmentForm.formation_type_id,
        day_of_week: assignmentForm.all_days ? null : assignmentForm.day_of_week,
        is_active: true,
        priority: 0,
      }

      if (editingAssignment) {
        const { error } = await supabase
          .from('user_formation_assignments')
          .update(assignmentData)
          .eq('id', editingAssignment.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('user_formation_assignments')
          .insert(assignmentData)

        if (error) throw error
      }

      fetchData()
      setShowAssignmentModal(false)
    } catch (err) {
      console.error('Error saving assignment:', err)
      alert('Erreur lors de l\'enregistrement')
    }
  }

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette attribution ?')) return

    try {
      const { error } = await supabase
        .from('user_formation_assignments')
        .delete()
        .eq('id', assignmentId)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error deleting assignment:', err)
      alert('Erreur lors de la suppression')
    }
  }

  const handleToggleAssignment = async (assignment: UserFormationAssignment) => {
    try {
      const { error } = await supabase
        .from('user_formation_assignments')
        .update({ is_active: !assignment.is_active })
        .eq('id', assignment.id)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error toggling assignment:', err)
    }
  }

  const handleDayToggle = (day: number) => {
    setAssignmentForm(prev => {
      const newDays = prev.day_of_week.includes(day)
        ? prev.day_of_week.filter(d => d !== day)
        : [...prev.day_of_week, day]
      return { ...prev, day_of_week: newDays }
    })
  }

  // Rule handlers
  const handleOpenRuleModal = (rule?: AssignmentRule) => {
    if (rule) {
      setEditingRule(rule)
      setRuleForm({
        name: rule.name,
        rule_type: rule.rule_type,
        assign_to_user_id: rule.assign_to_user_id || '',
        conditions: rule.conditions as Record<string, string>,
        priority: rule.priority,
        active: rule.active,
      })
    } else {
      setEditingRule(null)
      setRuleForm({
        name: '',
        rule_type: 'round_robin',
        assign_to_user_id: '',
        conditions: {},
        priority: assignmentRules.length + 1,
        active: true,
      })
    }
    setShowRuleModal(true)
  }

  const handleSaveRule = async () => {
    if (!profile?.team_id || !ruleForm.name) return

    try {
      const ruleData = {
        team_id: profile.team_id,
        name: ruleForm.name,
        rule_type: ruleForm.rule_type,
        assign_to_user_id: ruleForm.assign_to_user_id || null,
        conditions: ruleForm.conditions,
        priority: ruleForm.priority,
        active: ruleForm.active,
      }

      if (editingRule) {
        const { error } = await supabase
          .from('assignment_rules')
          .update(ruleData)
          .eq('id', editingRule.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('assignment_rules')
          .insert(ruleData)

        if (error) throw error
      }

      fetchData()
      setShowRuleModal(false)
    } catch (err) {
      console.error('Error saving rule:', err)
      alert('Erreur lors de l\'enregistrement')
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette règle ?')) return

    try {
      const { error } = await supabase
        .from('assignment_rules')
        .delete()
        .eq('id', ruleId)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error deleting rule:', err)
      alert('Erreur lors de la suppression')
    }
  }

  const handleToggleRule = async (rule: AssignmentRule) => {
    try {
      const { error } = await supabase
        .from('assignment_rules')
        .update({ active: !rule.active })
        .eq('id', rule.id)

      if (error) throw error
      fetchData()
    } catch (err) {
      console.error('Error toggling rule:', err)
    }
  }

  // Generate API key
  const handleGenerateApiKey = () => {
    const key = 'lm_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
    setApiKey(key)
  }

  // Google Calendar handlers
  const handleConnectGoogle = () => {
    if (!isGoogleCalendarConfigured()) {
      alert('Google Calendar n\'est pas configuré. Contactez l\'administrateur.')
      return
    }
    initGoogleAuth()
  }

  const handleDisconnectGoogle = async () => {
    if (!profile?.id) return
    if (!confirm('Êtes-vous sûr de vouloir déconnecter Google Calendar ?')) return

    const success = await disconnectGoogleCalendar(profile.id)
    if (success) {
      setGoogleCalendarConnected(false)
      setGoogleCalendarEmail(null)
    } else {
      alert('Erreur lors de la déconnexion')
    }
  }

  // Outlook Calendar handlers
  const handleConnectOutlook = () => {
    if (!isOutlookCalendarConfigured()) {
      alert('Outlook Calendar n\'est pas configuré. Contactez l\'administrateur.')
      return
    }
    initOutlookAuth()
  }

  const handleDisconnectOutlook = async () => {
    if (!profile?.id) return
    if (!confirm('Êtes-vous sûr de vouloir déconnecter Outlook Calendar ?')) return

    const success = await disconnectOutlookCalendar(profile.id)
    if (success) {
      setOutlookConnected(false)
      setOutlookEmail(null)
    } else {
      alert('Erreur lors de la déconnexion')
    }
  }

  const tabs = [
    { id: 'profile' as Tab, label: '👤 Profil', show: true },
    { id: 'team' as Tab, label: '👥 Équipe', show: profile?.role === 'admin' || profile?.role === 'manager' },
    { id: 'statuses' as Tab, label: '🏷️ Statuts', show: profile?.role === 'admin' || profile?.role === 'manager' },
    { id: 'formations' as Tab, label: '🎓 Formations', show: profile?.role === 'admin' },
    { id: 'assignments' as Tab, label: '👥 Attribution', show: profile?.role === 'admin' || profile?.role === 'manager' },
    { id: 'rules' as Tab, label: '⚙️ Règles', show: profile?.role === 'admin' || profile?.role === 'manager' },
    { id: 'ai' as Tab, label: '🤖 IA', show: profile?.role === 'admin' || profile?.role === 'manager' },
    { id: 'integrations' as Tab, label: '🔌 Intégrations', show: profile?.role === 'admin' },
    { id: 'billing' as Tab, label: '💳 Abonnement', show: profile?.role === 'admin' },
  ]

  const roleLabels: Record<string, string> = {
    admin: 'Admin',
    manager: 'Manager',
    sales: 'Commercial',
  }

  const planLabels: Record<string, string> = {
    free: 'Gratuit',
    starter: 'Starter',
    pro: 'Pro',
    enterprise: 'Enterprise',
  }

  return (
    <>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Paramètres</h1>

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar tabs */}
          <div className="md:w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.filter(t => t.show).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-6">Mon profil</h2>

                <div className="flex items-start gap-6 mb-6">
                  <div className="relative">
                    <Avatar
                      src={profile?.avatar_url}
                      alt={`${profile?.first_name} ${profile?.last_name}`}
                      size="lg"
                    />
                    <button className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 text-white rounded-full text-xs hover:bg-blue-700">
                      📷
                    </button>
                  </div>
                  <div>
                    <h3 className="font-medium">{profile?.first_name} {profile?.last_name}</h3>
                    <p className="text-sm text-gray-500">{profile?.email}</p>
                    <Badge className="mt-2">{roleLabels[profile?.role || 'sales']}</Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Input
                    label="Prénom"
                    value={profileForm.first_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, first_name: e.target.value }))}
                  />
                  <Input
                    label="Nom"
                    value={profileForm.last_name}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, last_name: e.target.value }))}
                  />
                  <Input
                    label="Email"
                    type="email"
                    value={profileForm.email}
                    disabled
                  />
                  <Select
                    label="Fuseau horaire"
                    value={profileForm.timezone}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, timezone: e.target.value }))}
                    options={[
                      { value: 'Europe/Paris', label: 'Europe/Paris (UTC+1)' },
                      { value: 'Europe/London', label: 'Europe/London (UTC)' },
                      { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
                    ]}
                  />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline">Changer le mot de passe</Button>
                  <Button onClick={handleSaveProfile} disabled={profileSaving}>
                    {profileSaving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                </div>
              </div>
            )}

            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-semibold">Membres de l'équipe</h2>
                  <Button onClick={() => setShowInviteModal(true)}>+ Inviter un membre</Button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Membre</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Rôle</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Leads actifs</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Formations</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">📅</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">
                            <div className="flex items-center gap-1">
                              🎯 Obj. Leads/mois
                            </div>
                          </th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">
                            <div className="flex items-center gap-1">
                              💰 Obj. Closings/mois
                            </div>
                          </th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {teamMembers.map(member => (
                          <tr key={member.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-3">
                                <Avatar src={member.avatar_url} alt={`${member.first_name} ${member.last_name}`} size="sm" />
                                <div>
                                  <span className="font-medium">{member.first_name} {member.last_name}</span>
                                  {member.id === profile?.id && (
                                    <span className="ml-2 text-xs text-gray-400">(vous)</span>
                                  )}
                                  <div className="text-xs text-gray-500">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">
                              {profile?.role === 'admin' && member.id !== profile?.id ? (
                                <select
                                  value={member.role}
                                  onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                                  className="text-sm border rounded px-2 py-1"
                                >
                                  {ROLE_OPTIONS.map(opt => (
                                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                                  ))}
                                </select>
                              ) : (
                                <span className="text-sm">{roleLabels[member.role]}</span>
                              )}
                            </td>
                            <td className="p-3 text-sm">{member.active_leads_count}</td>
                            <td className="p-3">
                              <div className="flex flex-wrap gap-1 max-w-48">
                                {formationAssignments
                                  .filter(a => a.user_id === member.id && a.is_active)
                                  .map(a => a.formation_type)
                                  .filter((ft, index, arr) => ft && arr.findIndex(f => f?.id === ft.id) === index) // unique
                                  .map(ft => ft && (
                                    <span
                                      key={ft.id}
                                      className="px-2 py-0.5 rounded-full text-xs font-medium"
                                      style={{ backgroundColor: ft.color + '20', color: ft.color }}
                                    >
                                      {ft.name}
                                    </span>
                                  ))}
                                {formationAssignments.filter(a => a.user_id === member.id && a.is_active).length === 0 && (
                                  <span className="text-xs text-gray-400">-</span>
                                )}
                              </div>
                            </td>
                            <td className="p-3">
                              {(() => {
                                const hasCalendar = member.google_calendar_connected || member.outlook_connected
                                return (
                                  <span
                                    title={hasCalendar
                                      ? `Calendrier connecté${member.google_calendar_connected ? ' (Google)' : ''}${member.outlook_connected ? ' (Outlook)' : ''}`
                                      : 'Ce commercial ne sera pas vérifié pour les dispos'
                                    }
                                    className="cursor-help"
                                  >
                                    {hasCalendar ? '✅' : '❌'}
                                  </span>
                                )
                              })()}
                            </td>
                            <td className="p-3">
                              {(profile?.role === 'admin' || profile?.role === 'manager') ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={member.monthly_lead_target || ''}
                                  onChange={(e) => handleUpdateMemberTargets(member.id, 'monthly_lead_target', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-20 text-sm border rounded px-2 py-1 text-center"
                                />
                              ) : (
                                <span className="text-sm">{member.monthly_lead_target || '-'}</span>
                              )}
                            </td>
                            <td className="p-3">
                              {(profile?.role === 'admin' || profile?.role === 'manager') ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={member.monthly_closing_target || ''}
                                  onChange={(e) => handleUpdateMemberTargets(member.id, 'monthly_closing_target', parseInt(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-20 text-sm border rounded px-2 py-1 text-center"
                                />
                              ) : (
                                <span className="text-sm">{member.monthly_closing_target || '-'}</span>
                              )}
                            </td>
                            <td className="p-3">
                              {member.id !== profile?.id && profile?.role === 'admin' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member.id)}
                                >
                                  ❌
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Statuses Tab */}
            {activeTab === 'statuses' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Statuts personnalisés</h2>
                    <p className="text-sm text-gray-500">Gérez les étapes de votre pipeline de vente</p>
                  </div>
                  <Button onClick={() => handleOpenStatusModal()}>+ Ajouter un statut</Button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : customStatuses.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">🏷️</div>
                    <p>Aucun statut personnalisé</p>
                    <Button className="mt-4" onClick={() => handleOpenStatusModal()}>
                      Créer votre premier statut
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {customStatuses.map((status, index) => (
                      <div
                        key={status.id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="cursor-grab text-gray-400 hover:text-gray-600">⋮⋮</span>
                        <div className="flex items-center gap-2 text-gray-400 text-sm w-8">
                          {index + 1}
                        </div>
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: status.color }}
                        />
                        <span className="flex-1 font-medium">{status.name}</span>
                        <Badge variant={status.is_active ? 'success' : 'default'}>
                          {status.is_active ? 'Actif' : 'Inactif'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenStatusModal(status)}
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteStatus(status.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Formations Tab */}
            {activeTab === 'formations' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Types de formation</h2>
                    <p className="text-sm text-gray-500">Gérez les types de formation pour classer vos leads</p>
                  </div>
                  <Button onClick={() => handleOpenFormationModal()}>+ Ajouter un type</Button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : formationTypes.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">🎓</div>
                    <p>Aucun type de formation</p>
                    <Button className="mt-4" onClick={() => handleOpenFormationModal()}>
                      Créer votre premier type
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formationTypes.map((formation, index) => (
                      <div
                        key={formation.id}
                        className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <span className="cursor-grab text-gray-400 hover:text-gray-600">⋮⋮</span>
                        <div className="flex items-center gap-2 text-gray-400 text-sm w-8">
                          {index + 1}
                        </div>
                        <div
                          className="w-6 h-6 rounded-full border-2 border-white shadow"
                          style={{ backgroundColor: formation.color }}
                        />
                        <div className="flex-1">
                          <span className="font-medium">{formation.name}</span>
                          {formation.description && (
                            <p className="text-sm text-gray-500">{formation.description}</p>
                          )}
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formation.is_active}
                            onChange={() => handleToggleFormation(formation)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-gray-500">Actif</span>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenFormationModal(formation)}
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFormation(formation.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Assignments Tab */}
            {activeTab === 'assignments' && (
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-lg font-semibold">Attribution par formation</h2>
                    <p className="text-sm text-gray-500">Configurez quel commercial gère quels types de formation, et quel jour</p>
                  </div>
                  <Button onClick={() => handleOpenAssignmentModal()}>+ Ajouter une attribution</Button>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : formationAssignments.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">👥</div>
                    <p>Aucune attribution configurée</p>
                    <p className="text-sm mt-1">Les nouveaux leads ne seront pas automatiquement assignés par formation</p>
                    <Button className="mt-4" onClick={() => handleOpenAssignmentModal()}>
                      Créer votre première attribution
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Commercial</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Formation</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Jours</th>
                          <th className="p-3 text-left text-sm font-medium text-gray-600">Actif</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {formationAssignments.map((assignment) => (
                          <tr key={assignment.id} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">
                                  {assignment.user?.first_name} {assignment.user?.last_name}
                                </span>
                              </div>
                            </td>
                            <td className="p-3">
                              {assignment.formation_type && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: assignment.formation_type.color + '20', color: assignment.formation_type.color }}
                                >
                                  {assignment.formation_type.name}
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              {!assignment.day_of_week || assignment.day_of_week.length === 0 ? (
                                <span className="text-sm text-gray-500">Tous les jours</span>
                              ) : (
                                <div className="flex gap-1 flex-wrap">
                                  {DAYS_OF_WEEK
                                    .filter(d => assignment.day_of_week?.includes(d.value))
                                    .map(d => (
                                      <span
                                        key={d.value}
                                        className="px-2 py-0.5 bg-gray-100 rounded text-xs"
                                      >
                                        {d.short}
                                      </span>
                                    ))}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={assignment.is_active}
                                  onChange={() => handleToggleAssignment(assignment)}
                                  className="w-4 h-4 rounded"
                                />
                              </label>
                            </td>
                            <td className="p-3">
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenAssignmentModal(assignment)}
                                >
                                  ✏️
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteAssignment(assignment.id)}
                                >
                                  🗑️
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Info box */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <div>
                      <p className="text-sm text-blue-800">
                        <strong>Comment ça marche :</strong> Lorsqu'un nouveau lead arrive avec un type de formation,
                        il sera automatiquement assigné au commercial configuré pour cette formation (si le jour correspond).
                      </p>
                      <p className="text-sm text-blue-600 mt-2">
                        Si plusieurs commerciaux sont configurés pour la même formation et le même jour,
                        le système utilisera un round-robin basé sur la charge de travail actuelle.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Rules Tab */}
            {activeTab === 'rules' && (
              <div className="space-y-6">
                {/* Calendar Availability Check */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📅</span>
                        <h3 className="font-semibold">Vérifier les disponibilités calendrier</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Avant d'attribuer un lead, vérifier si le commercial a un créneau libre dans son calendrier
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const newValue = !calendarCheckEnabled
                        setCalendarCheckEnabled(newValue)
                        setCalendarSettingsSaving(true)
                        await updateTeamCalendarSettings(profile?.team_id || '', { checkCalendar: newValue })
                        setCalendarSettingsSaving(false)
                      }}
                      disabled={calendarSettingsSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        calendarCheckEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        calendarCheckEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>

                  {calendarCheckEnabled && (
                    <div className="mt-4 pt-4 border-t space-y-4">
                      <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <p className="text-sm text-blue-800">
                          <strong>Important :</strong> Les commerciaux doivent connecter leur Google Calendar ou Outlook dans la section Intégrations pour que cette fonctionnalité fonctionne.
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Si aucun commercial n'est disponible :
                        </label>
                        <select
                          value={calendarFallbackStrategy}
                          onChange={async (e) => {
                            const newValue = e.target.value as 'next_available' | 'round_robin' | 'manual'
                            setCalendarFallbackStrategy(newValue)
                            setCalendarSettingsSaving(true)
                            await updateTeamCalendarSettings(profile?.team_id || '', { fallbackStrategy: newValue })
                            setCalendarSettingsSaving(false)
                          }}
                          disabled={calendarSettingsSaving}
                          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="next_available">Assigner au prochain disponible</option>
                          <option value="round_robin">Round-robin classique (ignorer calendrier)</option>
                          <option value="manual">Laisser non assigné (attribution manuelle)</option>
                        </select>
                      </div>

                      {/* Team members calendar status */}
                      <div className="mt-4">
                        <p className="text-sm font-medium text-gray-700 mb-2">Statut des calendriers :</p>
                        <div className="flex flex-wrap gap-2">
                          {teamMembers.map(member => {
                            const hasCalendar = member.google_calendar_connected || member.outlook_connected
                            return (
                              <div
                                key={member.id}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                                  hasCalendar ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                                }`}
                                title={hasCalendar ? 'Calendrier connecté' : 'Ce commercial ne sera pas vérifié pour les dispos'}
                              >
                                <span>{hasCalendar ? '✅' : '❌'}</span>
                                <span>{member.first_name} {member.last_name}</span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Assignment Rules */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-lg font-semibold">Règles d'attribution</h2>
                      <p className="text-sm text-gray-500">Automatisez l'assignation des leads</p>
                    </div>
                    <Button onClick={() => handleOpenRuleModal()}>+ Ajouter une règle</Button>
                  </div>

                  {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : assignmentRules.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-4xl mb-2">⚙️</div>
                    <p>Aucune règle d'attribution</p>
                    <p className="text-sm mt-1">Les leads seront assignés manuellement</p>
                    <Button className="mt-4" onClick={() => handleOpenRuleModal()}>
                      Créer votre première règle
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {assignmentRules.map((rule) => (
                      <div
                        key={rule.id}
                        className={`flex items-center gap-4 p-4 rounded-lg border ${
                          rule.active ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-2 text-gray-400 text-sm w-8">
                          #{rule.priority}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{rule.name}</span>
                            {!rule.active && (
                              <Badge variant="default">Désactivé</Badge>
                            )}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            Type: {RULE_TYPES.find(t => t.value === rule.rule_type)?.label || rule.rule_type}
                            {rule.assign_to_user_id && (
                              <span className="ml-2">
                                → {teamMembers.find(m => m.id === rule.assign_to_user_id)?.first_name || 'Utilisateur'}
                              </span>
                            )}
                          </div>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={rule.active}
                            onChange={() => handleToggleRule(rule)}
                            className="w-4 h-4 rounded"
                          />
                          <span className="text-sm text-gray-500">Actif</span>
                        </label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenRuleModal(rule)}
                        >
                          ✏️
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteRule(rule.id)}
                        >
                          🗑️
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                </div>
              </div>
            )}

            {/* AI Configuration Tab */}
            {activeTab === 'ai' && (
              <div className="space-y-6">
                {/* AI Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg shadow p-6 text-white">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-2xl">🤖</span>
                    Configuration IA
                  </h2>
                  <p className="text-indigo-100 mt-2">
                    Configurez le comportement de l'intelligence artificielle pour votre équipe
                  </p>
                </div>

                {/* Scoring Automatique */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🎯</span>
                        <h3 className="font-semibold">Scoring automatique</h3>
                        <Badge variant="success">Toujours actif</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Chaque nouveau lead est automatiquement analysé et scoré par l'IA
                      </p>
                    </div>
                    <div className="relative">
                      <button
                        disabled
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-indigo-600 cursor-not-allowed opacity-75"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action recommandée automatique */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">💡</span>
                        <h3 className="font-semibold">Action recommandée automatique</h3>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        L'IA définit automatiquement la prochaine action à effectuer sur chaque lead
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const newConfig = { ...aiConfig, auto_action_recommendation: !aiConfig.auto_action_recommendation }
                        setAIConfig(newConfig)
                        setAIConfigSaving(true)
                        await updateTeamAIConfig(profile?.team_id || '', newConfig)
                        setAIConfigSaving(false)
                      }}
                      disabled={aiConfigSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        aiConfig.auto_action_recommendation ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        aiConfig.auto_action_recommendation ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Enrichissement automatique */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🔍</span>
                        <h3 className="font-semibold">Enrichissement automatique</h3>
                        <Badge variant="warning">Bientôt</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        L'IA recherche automatiquement des informations supplémentaires sur vos leads
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const newConfig = { ...aiConfig, auto_enrichment: !aiConfig.auto_enrichment }
                        setAIConfig(newConfig)
                        setAIConfigSaving(true)
                        await updateTeamAIConfig(profile?.team_id || '', newConfig)
                        setAIConfigSaving(false)
                      }}
                      disabled={aiConfigSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        aiConfig.auto_enrichment ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        aiConfig.auto_enrichment ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Génération de scripts automatique */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">📝</span>
                        <h3 className="font-semibold">Génération de scripts automatique</h3>
                        <Badge variant="warning">Bientôt</Badge>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        L'IA génère automatiquement des scripts d'appel et d'email personnalisés
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const newConfig = { ...aiConfig, auto_script_generation: !aiConfig.auto_script_generation }
                        setAIConfig(newConfig)
                        setAIConfigSaving(true)
                        await updateTeamAIConfig(profile?.team_id || '', newConfig)
                        setAIConfigSaving(false)
                      }}
                      disabled={aiConfigSaving}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        aiConfig.auto_script_generation ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        aiConfig.auto_script_generation ? 'translate-x-6' : 'translate-x-1'
                      }`} />
                    </button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">💡</span>
                    <div>
                      <p className="text-sm text-blue-800">
                        <strong>Note :</strong> Le scoring automatique est toujours actif pour assurer une qualification optimale de vos leads.
                        Les autres fonctionnalités peuvent être activées selon vos besoins.
                      </p>
                      <p className="text-sm text-blue-600 mt-2">
                        Assurez-vous d'avoir configuré votre clé API OpenAI dans l'onglet Intégrations.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Integrations Tab */}
            {activeTab === 'integrations' && (
              <div className="space-y-6">
                {/* API Key */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-2">Clé API</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Utilisez cette clé pour intégrer Lead Manager avec vos outils
                  </p>

                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <input
                        type={showApiKey ? 'text' : 'password'}
                        value={apiKey || 'Aucune clé générée'}
                        readOnly
                        className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-mono text-sm"
                      />
                      {apiKey && (
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showApiKey ? '👁️' : '👁️‍🗨️'}
                        </button>
                      )}
                    </div>
                    <Button variant="outline" onClick={handleGenerateApiKey}>
                      {apiKey ? 'Régénérer' : 'Générer'}
                    </Button>
                    {apiKey && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(apiKey)
                          alert('Clé copiée !')
                        }}
                      >
                        📋 Copier
                      </Button>
                    )}
                  </div>
                </div>

                {/* OpenAI Integration */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">🤖</span>
                    <h2 className="text-lg font-semibold">OpenAI</h2>
                    <Badge variant={openaiKey ? 'success' : 'default'}>
                      {openaiKey ? 'Connecté' : 'Non configuré'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Connectez OpenAI pour activer le scoring IA et la génération de scripts
                  </p>

                  <div className="flex gap-3">
                    <Input
                      type="password"
                      placeholder="sk-..."
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      className="flex-1"
                    />
                    <Button disabled={!openaiKey}>
                      Connecter
                    </Button>
                  </div>
                </div>

                {/* Google Calendar Integration */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📅</span>
                    <h2 className="text-lg font-semibold">Google Calendar</h2>
                    <Badge variant={googleCalendarConnected ? 'success' : 'default'}>
                      {googleCalendarConnected ? '✅ Connecté' : 'Non connecté'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Synchronisez vos rendez-vous avec Google Calendar et créez automatiquement des liens Google Meet
                  </p>

                  {googleConnecting ? (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="text-blue-700">Connexion en cours...</span>
                    </div>
                  ) : googleCalendarConnected ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">✅</span>
                          <div>
                            <div className="font-medium text-green-800">Connecté</div>
                            {googleCalendarEmail && (
                              <div className="text-sm text-green-600">{googleCalendarEmail}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleDisconnectGoogle}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          Déconnecter
                        </Button>
                      </div>
                      <div className="text-sm text-gray-500">
                        <strong>Fonctionnalités activées :</strong>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          <li>Sync automatique des RDV vers Google Calendar</li>
                          <li>Création de liens Google Meet pour les visios</li>
                          <li>Rappels automatiques par email</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Button onClick={handleConnectGoogle} className="w-full">
                        <span className="mr-2">🔗</span>
                        Connecter Google Calendar
                      </Button>
                      {!isGoogleCalendarConfigured() && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                          ⚠️ L'intégration Google Calendar nécessite une configuration OAuth.
                          Ajoutez <code className="bg-yellow-100 px-1 rounded">VITE_GOOGLE_CLIENT_ID</code> et{' '}
                          <code className="bg-yellow-100 px-1 rounded">VITE_GOOGLE_CLIENT_SECRET</code> dans votre fichier .env
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Outlook Calendar Integration */}
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📆</span>
                    <h2 className="text-lg font-semibold">Outlook / Microsoft 365</h2>
                    <Badge variant={outlookConnected ? 'success' : 'default'}>
                      {outlookConnected ? '✅ Connecté' : 'Non connecté'}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    Synchronisez vos rendez-vous avec Outlook Calendar et créez automatiquement des réunions Teams
                  </p>

                  {outlookConnecting ? (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                      <span className="text-blue-700">Connexion en cours...</span>
                    </div>
                  ) : outlookConnected ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">✅</span>
                          <div>
                            <div className="font-medium text-green-800">Connecté</div>
                            {outlookEmail && (
                              <div className="text-sm text-green-600">{outlookEmail}</div>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          onClick={handleDisconnectOutlook}
                          className="text-red-600 border-red-300 hover:bg-red-50"
                        >
                          Déconnecter
                        </Button>
                      </div>
                      <div className="text-sm text-gray-500">
                        <strong>Fonctionnalités activées :</strong>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          <li>Sync automatique des RDV vers Outlook Calendar</li>
                          <li>Création de réunions Microsoft Teams pour les visios</li>
                          <li>Rappels automatiques</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Button onClick={handleConnectOutlook} className="w-full">
                        <span className="mr-2">🔗</span>
                        Connecter Outlook / Microsoft 365
                      </Button>
                      {!isOutlookCalendarConfigured() && (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                          ⚠️ L'intégration Outlook nécessite une configuration Azure AD.
                          Ajoutez <code className="bg-yellow-100 px-1 rounded">VITE_MICROSOFT_CLIENT_ID</code> et{' '}
                          <code className="bg-yellow-100 px-1 rounded">VITE_MICROSOFT_CLIENT_SECRET</code> dans votre fichier .env
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Webhooks */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-2">Webhooks</h2>
                  <p className="text-sm text-gray-500 mb-4">
                    Recevez des notifications en temps réel
                  </p>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">Nouveau lead</div>
                        <div className="text-sm text-gray-500">POST https://...</div>
                      </div>
                      <Button variant="outline" size="sm">Configurer</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">Changement de statut</div>
                        <div className="text-sm text-gray-500">Non configuré</div>
                      </div>
                      <Button variant="outline" size="sm">Configurer</Button>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">Closing</div>
                        <div className="text-sm text-gray-500">Non configuré</div>
                      </div>
                      <Button variant="outline" size="sm">Configurer</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                {/* Current Plan */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">Votre abonnement</h2>

                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg mb-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-blue-600">
                          {planLabels[team?.subscription_plan || 'free']}
                        </span>
                        <Badge variant={team?.subscription_status === 'active' ? 'success' : 'warning'}>
                          {team?.subscription_status === 'active' ? 'Actif' :
                           team?.subscription_status === 'trial' ? 'Essai' : 'Expiré'}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {team?.current_lead_count || 0} / {team?.max_leads || 100} leads utilisés
                      </p>
                    </div>
                    <Button>Upgrader</Button>
                  </div>

                  {/* Usage */}
                  <div className="mb-6">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Utilisation des leads</span>
                      <span className="font-medium">
                        {team?.current_lead_count || 0} / {team?.max_leads || 100}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="h-3 rounded-full bg-blue-600 transition-all"
                        style={{
                          width: `${Math.min(((team?.current_lead_count || 0) / (team?.max_leads || 100)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Plans comparison */}
                  <h3 className="font-medium mb-4">Comparer les plans</h3>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { name: 'Gratuit', price: '0€', leads: '100', users: '2' },
                      { name: 'Starter', price: '29€', leads: '1 000', users: '5' },
                      { name: 'Pro', price: '79€', leads: '10 000', users: '15' },
                      { name: 'Enterprise', price: 'Sur devis', leads: 'Illimité', users: 'Illimité' },
                    ].map((plan) => (
                      <div
                        key={plan.name}
                        className={`p-4 rounded-lg border-2 ${
                          planLabels[team?.subscription_plan || 'free'] === plan.name
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="font-bold">{plan.name}</div>
                        <div className="text-2xl font-bold text-blue-600 my-2">{plan.price}</div>
                        <div className="text-sm text-gray-500 space-y-1">
                          <div>{plan.leads} leads</div>
                          <div>{plan.users} utilisateurs</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Billing History */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h2 className="text-lg font-semibold mb-4">Historique de facturation</h2>
                  <div className="text-center py-8 text-gray-500">
                    <div className="text-4xl mb-2">📄</div>
                    <p>Aucune facture pour le moment</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <Modal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Inviter un membre"
      >
        <div className="space-y-4">
          <Input
            label="Email"
            type="email"
            value={inviteForm.email}
            onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
            placeholder="email@exemple.com"
          />
          <Select
            label="Rôle"
            value={inviteForm.role}
            onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
            options={ROLE_OPTIONS}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleInviteMember}>
              Envoyer l'invitation
            </Button>
          </div>
        </div>
      </Modal>

      {/* Status Modal */}
      <Modal
        isOpen={showStatusModal}
        onClose={() => setShowStatusModal(false)}
        title={editingStatus ? 'Modifier le statut' : 'Nouveau statut'}
      >
        <div className="space-y-4">
          <Input
            label="Nom du statut"
            value={statusForm.name}
            onChange={(e) => setStatusForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: En attente"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Couleur
            </label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setStatusForm(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    statusForm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={statusForm.color}
                onChange={(e) => setStatusForm(prev => ({ ...prev, color: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowStatusModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveStatus}>
              {editingStatus ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Formation Type Modal */}
      <Modal
        isOpen={showFormationModal}
        onClose={() => setShowFormationModal(false)}
        title={editingFormation ? 'Modifier le type de formation' : 'Nouveau type de formation'}
      >
        <div className="space-y-4">
          <Input
            label="Nom du type"
            value={formationForm.name}
            onChange={(e) => setFormationForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: MAO, Guitare, Piano..."
          />
          <Input
            label="Description (optionnel)"
            value={formationForm.description}
            onChange={(e) => setFormationForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Description du type de formation"
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Couleur
            </label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLORS.map(color => (
                <button
                  key={color}
                  onClick={() => setFormationForm(prev => ({ ...prev, color }))}
                  className={`w-8 h-8 rounded-full border-2 transition-transform ${
                    formationForm.color === color ? 'border-gray-900 scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
              <input
                type="color"
                value={formationForm.color}
                onChange={(e) => setFormationForm(prev => ({ ...prev, color: e.target.value }))}
                className="w-8 h-8 rounded cursor-pointer"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowFormationModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveFormation}>
              {editingFormation ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Assignment Modal */}
      <Modal
        isOpen={showAssignmentModal}
        onClose={() => setShowAssignmentModal(false)}
        title={editingAssignment ? 'Modifier l\'attribution' : 'Nouvelle attribution'}
      >
        <div className="space-y-4">
          <Select
            label="Commercial"
            value={assignmentForm.user_id}
            onChange={(e) => setAssignmentForm(prev => ({ ...prev, user_id: e.target.value }))}
            options={teamMembers.map(m => ({
              value: m.id,
              label: `${m.first_name} ${m.last_name}`,
            }))}
            placeholder="Sélectionner un commercial"
          />

          <Select
            label="Type de formation"
            value={assignmentForm.formation_type_id}
            onChange={(e) => setAssignmentForm(prev => ({ ...prev, formation_type_id: e.target.value }))}
            options={formationTypes.filter(ft => ft.is_active).map(ft => ({
              value: ft.id,
              label: ft.name,
            }))}
            placeholder="Sélectionner une formation"
          />

          <div>
            <label className="flex items-center gap-2 mb-3">
              <input
                type="checkbox"
                checked={assignmentForm.all_days}
                onChange={(e) => setAssignmentForm(prev => ({
                  ...prev,
                  all_days: e.target.checked,
                  day_of_week: e.target.checked ? [] : prev.day_of_week,
                }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm font-medium">Tous les jours</span>
            </label>

            {!assignmentForm.all_days && (
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map(day => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => handleDayToggle(day.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      assignmentForm.day_of_week.includes(day.value)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowAssignmentModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveAssignment}
              disabled={!assignmentForm.user_id || !assignmentForm.formation_type_id}
            >
              {editingAssignment ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rule Modal */}
      <Modal
        isOpen={showRuleModal}
        onClose={() => setShowRuleModal(false)}
        title={editingRule ? 'Modifier la règle' : 'Nouvelle règle'}
      >
        <div className="space-y-4">
          <Input
            label="Nom de la règle"
            value={ruleForm.name}
            onChange={(e) => setRuleForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Distribution secteur Tech"
          />
          <Select
            label="Type de règle"
            value={ruleForm.rule_type}
            onChange={(e) => setRuleForm(prev => ({ ...prev, rule_type: e.target.value }))}
            options={RULE_TYPES}
          />

          {ruleForm.rule_type !== 'round_robin' && (
            <>
              <Select
                label="Assigner à"
                value={ruleForm.assign_to_user_id}
                onChange={(e) => setRuleForm(prev => ({ ...prev, assign_to_user_id: e.target.value }))}
                options={teamMembers.map(m => ({
                  value: m.id,
                  label: `${m.first_name} ${m.last_name}`,
                }))}
                placeholder="Sélectionner un membre"
              />

              {ruleForm.rule_type === 'sector' && (
                <Input
                  label="Secteur (contient)"
                  value={ruleForm.conditions.sector || ''}
                  onChange={(e) => setRuleForm(prev => ({
                    ...prev,
                    conditions: { ...prev.conditions, sector: e.target.value }
                  }))}
                  placeholder="Ex: Tech, SaaS, Digital"
                />
              )}

              {ruleForm.rule_type === 'company_size' && (
                <Select
                  label="Taille entreprise"
                  value={ruleForm.conditions.company_size || ''}
                  onChange={(e) => setRuleForm(prev => ({
                    ...prev,
                    conditions: { ...prev.conditions, company_size: e.target.value }
                  }))}
                  options={[
                    { value: '1-10', label: '1-10 employés' },
                    { value: '11-50', label: '11-50 employés' },
                    { value: '51-200', label: '51-200 employés' },
                    { value: '201-500', label: '201-500 employés' },
                    { value: '500+', label: '500+ employés' },
                  ]}
                />
              )}

              {ruleForm.rule_type === 'keyword' && (
                <Input
                  label="Mot-clé (dans entreprise ou notes)"
                  value={ruleForm.conditions.keyword || ''}
                  onChange={(e) => setRuleForm(prev => ({
                    ...prev,
                    conditions: { ...prev.conditions, keyword: e.target.value }
                  }))}
                  placeholder="Ex: startup, e-commerce"
                />
              )}
            </>
          )}

          <Input
            label="Priorité"
            type="number"
            min={1}
            value={ruleForm.priority}
            onChange={(e) => setRuleForm(prev => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
          />

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={ruleForm.active}
              onChange={(e) => setRuleForm(prev => ({ ...prev, active: e.target.checked }))}
              className="w-4 h-4 rounded"
            />
            <span className="text-sm">Règle active</span>
          </label>

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowRuleModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveRule}>
              {editingRule ? 'Enregistrer' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
