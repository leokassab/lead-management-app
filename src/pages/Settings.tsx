import { useState, useEffect } from 'react'
import { Layout } from '../components/layout'
import { Button, Avatar, Input, Select, Modal, Badge } from '../components/ui'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import type { CustomStatus, User, AssignmentRule, Team } from '../types'

type Tab = 'profile' | 'team' | 'statuses' | 'rules' | 'integrations' | 'billing'

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
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([])
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
  }, [profile])

  const fetchData = async () => {
    if (!profile?.team_id) return

    setLoading(true)
    try {
      const [membersRes, statusesRes, rulesRes, teamRes] = await Promise.all([
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
          .from('assignment_rules')
          .select('*')
          .eq('team_id', profile.team_id)
          .order('priority'),
        supabase
          .from('teams')
          .select('*')
          .eq('id', profile.team_id)
          .single(),
      ])

      if (membersRes.data) setTeamMembers(membersRes.data)
      if (statusesRes.data) setCustomStatuses(statusesRes.data)
      if (rulesRes.data) setAssignmentRules(rulesRes.data)
      if (teamRes.data) setTeam(teamRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

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

  const tabs = [
    { id: 'profile' as Tab, label: '👤 Profil', show: true },
    { id: 'team' as Tab, label: '👥 Équipe', show: profile?.role === 'admin' || profile?.role === 'manager' },
    { id: 'statuses' as Tab, label: '🏷️ Statuts', show: profile?.role === 'admin' || profile?.role === 'manager' },
    { id: 'rules' as Tab, label: '⚙️ Règles', show: profile?.role === 'admin' || profile?.role === 'manager' },
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
    <Layout>
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
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Membre</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Email</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Rôle</th>
                        <th className="p-3 text-left text-sm font-medium text-gray-600">Leads actifs</th>
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
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-sm text-gray-600">{member.email}</td>
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

            {/* Rules Tab */}
            {activeTab === 'rules' && (
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
    </Layout>
  )
}
