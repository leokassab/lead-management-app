import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout'
import { Button, Badge, Avatar, Modal, Input, Select } from '../components/ui'
import AIPanel from '../components/leads/AIPanel'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { formatDateTime } from '../utils/formatters'
import { getPriorityLabel, getNextActionLabel } from '../utils/helpers'
import type { Lead, CustomStatus, Activity, User } from '../types'

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()

  const [lead, setLead] = useState<Lead | null>(null)
  const [statuses, setStatuses] = useState<CustomStatus[]>([])
  const [activities, setActivities] = useState<Activity[]>([])
  const [teamMembers, setTeamMembers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  // Comment
  const [commentText, setCommentText] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)

  // Next action modal
  const [showActionModal, setShowActionModal] = useState(false)
  const [nextAction, setNextAction] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')

  // Active tab
  const [activeTab, setActiveTab] = useState<'info' | 'ai'>('info')

  useEffect(() => {
    if (id && profile?.team_id) {
      fetchData()
    }
  }, [id, profile])

  const fetchData = async () => {
    if (!id || !profile?.team_id) return

    setLoading(true)
    try {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase
        .from('leads')
        .select(`
          *,
          assignedUser:users!leads_assigned_to_fkey(
            id, first_name, last_name, email, avatar_url
          )
        `)
        .eq('id', id)
        .single()

      if (leadError) throw leadError
      setLead(leadData)

      // Fetch statuses
      const { data: statusesData } = await supabase
        .from('custom_statuses')
        .select('*')
        .eq('team_id', profile.team_id)
        .order('order_position')

      if (statusesData) setStatuses(statusesData)

      // Fetch team members
      const { data: membersData } = await supabase
        .from('users')
        .select('*')
        .eq('team_id', profile.team_id)

      if (membersData) setTeamMembers(membersData)

      // Fetch activities
      const { data: activitiesData } = await supabase
        .from('activities')
        .select(`
          *,
          user:users(id, first_name, last_name, avatar_url)
        `)
        .eq('lead_id', id)
        .order('created_at', { ascending: false })

      if (activitiesData) setActivities(activitiesData)
    } catch (error) {
      console.error('Error fetching lead:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    if (!lead) return

    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', lead.id)

      if (error) throw error

      // Add activity
      await supabase.from('activities').insert({
        lead_id: lead.id,
        user_id: profile?.id,
        activity_type: 'status_change',
        description: `Statut changé en "${newStatus}"`,
      })

      setLead({ ...lead, status: newStatus })
      fetchData()
    } catch (error) {
      console.error('Error updating status:', error)
    }
  }

  const handleAddComment = async () => {
    if (!lead || !commentText.trim()) return

    setSubmittingComment(true)
    try {
      const { error } = await supabase.from('activities').insert({
        lead_id: lead.id,
        user_id: profile?.id,
        activity_type: 'comment',
        comment_text: commentText,
        description: 'A ajouté un commentaire',
      })

      if (error) throw error

      setCommentText('')
      fetchData()
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleSetNextAction = async () => {
    if (!lead || !nextAction) return

    try {
      const { error } = await supabase
        .from('leads')
        .update({
          next_action: nextAction,
          next_action_date: nextActionDate || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', lead.id)

      if (error) throw error

      setLead({
        ...lead,
        next_action: nextAction as Lead['next_action'],
        next_action_date: nextActionDate || undefined,
      })
      setShowActionModal(false)
    } catch (error) {
      console.error('Error setting next action:', error)
    }
  }

  const handleReassign = async (userId: string) => {
    if (!lead) return

    try {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .eq('id', lead.id)

      if (error) throw error

      // Add activity
      const newUser = teamMembers.find(m => m.id === userId)
      await supabase.from('activities').insert({
        lead_id: lead.id,
        user_id: profile?.id,
        activity_type: 'assignment',
        description: `Lead réassigné à ${newUser?.first_name} ${newUser?.last_name}`,
      })

      fetchData()
    } catch (error) {
      console.error('Error reassigning:', error)
    }
  }

  const handleDelete = async () => {
    if (!lead) return
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce lead ?')) return

    try {
      const { error } = await supabase.from('leads').delete().eq('id', lead.id)
      if (error) throw error
      navigate('/leads')
    } catch (error) {
      console.error('Error deleting lead:', error)
    }
  }

  const getStatusColor = (statusName: string) => {
    const status = statuses.find(s => s.name === statusName)
    return status?.color || '#9CA3AF'
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'call': return '📞'
      case 'email_sent': return '📧'
      case 'comment': return '💬'
      case 'status_change': return '🔄'
      case 'assignment': return '👤'
      case 'note': return '📝'
      case 'meeting_scheduled': return '📅'
      case 'closing': return '🎉'
      default: return '📌'
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </Layout>
    )
  }

  if (!lead) {
    return (
      <Layout>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">🔍</div>
          <h2 className="text-xl font-semibold text-gray-900">Lead non trouvé</h2>
          <Button className="mt-4" onClick={() => navigate('/leads')}>
            Retour aux leads
          </Button>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* Header */}
      <div className="bg-white border-b -mx-4 -mt-6 px-6 py-4 mb-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/leads')} className="text-gray-500 hover:text-gray-700">
              ← Retour
            </button>
            <Avatar
              src={lead.assignedUser?.avatar_url}
              alt={lead.assignedUser ? `${lead.assignedUser.first_name} ${lead.assignedUser.last_name}` : ''}
              size="lg"
            />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {lead.full_name || `${lead.first_name} ${lead.last_name}`}
              </h1>
              <p className="text-gray-600">{lead.company_name}</p>
              {lead.assignedUser && (
                <p className="text-sm text-gray-500">
                  Assigné à {lead.assignedUser.first_name} {lead.assignedUser.last_name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {lead.ai_score !== undefined && (
              <div className="text-center">
                <div className={`text-2xl font-bold ${
                  lead.ai_score >= 70 ? 'text-green-600' :
                  lead.ai_score >= 40 ? 'text-orange-600' : 'text-red-600'
                }`}>
                  {lead.ai_score}/100
                </div>
                <div className="text-xs text-gray-500">Score IA</div>
              </div>
            )}

            <Badge color={getStatusColor(lead.priority)} className="text-sm px-3 py-1">
              {getPriorityLabel(lead.priority)}
            </Badge>

            <select
              value={lead.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white font-medium"
              style={{ borderLeftColor: getStatusColor(lead.status), borderLeftWidth: 4 }}
            >
              {statuses.map(status => (
                <option key={status.id} value={status.name}>{status.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="border-b border-gray-200 bg-white rounded-t-lg px-4">
            <nav className="flex gap-6">
              <button
                onClick={() => setActiveTab('info')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'info'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                📋 Informations
              </button>
              <button
                onClick={() => setActiveTab('ai')}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                  activeTab === 'ai'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                🤖 Intelligence IA
                {lead.ai_analyzed && (
                  <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                    {lead.ai_score}
                  </span>
                )}
              </button>
            </nav>
          </div>

          {/* Info Tab */}
          {activeTab === 'info' && (
            <>
          {/* Informations */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">📋 Informations</h2>
            <div className="grid grid-cols-2 gap-4">
              <InfoItem icon="📧" label="Email" value={lead.email} />
              <InfoItem icon="📞" label="Téléphone" value={lead.phone} />
              <InfoItem icon="💼" label="Poste" value={lead.job_title} />
              <InfoItem icon="🏢" label="Entreprise" value={lead.company_name} />
              <InfoItem icon="🔗" label="LinkedIn" value={lead.linkedin_url} isLink />
              <InfoItem icon="🌐" label="Site web" value={lead.website} isLink />
              <InfoItem icon="📍" label="Localisation" value={lead.city && lead.country ? `${lead.city}, ${lead.country}` : lead.city || lead.country} />
              <InfoItem icon="📊" label="Secteur" value={lead.sector} />
              <InfoItem icon="👥" label="Taille" value={lead.company_size} />
              <InfoItem icon="🏷️" label="Type" value={lead.lead_type} />
              <InfoItem icon="✅" label="Décisionnaire" value={lead.is_decision_maker ? 'Oui' : 'Non'} />
              <InfoItem icon="📥" label="Source" value={lead.source} />
            </div>
          </section>

          {/* Historique & Commentaires */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">💬 Historique & Commentaires</h2>

            {/* Timeline */}
            <div className="space-y-4 mb-6">
              {activities.length === 0 ? (
                <div className="text-center text-gray-500 py-4">
                  Aucune activité pour le moment
                </div>
              ) : (
                activities.map(activity => (
                  <div key={activity.id} className="flex gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-lg">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{formatDateTime(activity.created_at)}</span>
                        <span>•</span>
                        <span>{activity.user?.first_name} {activity.user?.last_name}</span>
                      </div>
                      <p className="mt-1 text-gray-700">{activity.description}</p>
                      {activity.comment_text && (
                        <div className="mt-2 p-3 bg-gray-50 rounded text-gray-800">
                          {activity.comment_text}
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add comment */}
            <div className="border-t pt-4">
              <textarea
                placeholder="Ajouter un commentaire..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-24"
              />
              <div className="flex justify-end mt-3">
                <Button onClick={handleAddComment} disabled={!commentText.trim() || submittingComment}>
                  {submittingComment ? 'Envoi...' : 'Ajouter commentaire'}
                </Button>
              </div>
            </div>
          </section>
            </>
          )}

          {/* AI Tab */}
          {activeTab === 'ai' && (
            <AIPanel lead={lead} onLeadUpdate={fetchData} />
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions rapides */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">⚡ Actions rapides</h2>
            <div className="space-y-3">
              {lead.email && (
                <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = `mailto:${lead.email}`}>
                  📧 Envoyer email
                </Button>
              )}
              {lead.phone && (
                <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = `tel:${lead.phone}`}>
                  📞 Appeler
                </Button>
              )}
              <Button variant="outline" className="w-full justify-start" onClick={() => setShowActionModal(true)}>
                📅 Planifier action
              </Button>

              <hr className="my-3" />

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Réassigner à</label>
                <select
                  value={lead.assigned_to || ''}
                  onChange={(e) => handleReassign(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="">Non assigné</option>
                  {teamMembers.map(member => (
                    <option key={member.id} value={member.id}>
                      {member.first_name} {member.last_name}
                    </option>
                  ))}
                </select>
              </div>

              {(profile?.role === 'admin' || profile?.role === 'manager') && (
                <>
                  <hr className="my-3" />
                  <Button variant="ghost" className="w-full justify-start text-red-600" onClick={handleDelete}>
                    🗑️ Supprimer
                  </Button>
                </>
              )}
            </div>
          </section>

          {/* Prochaine action */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">📅 Prochaine action</h2>
            {lead.next_action ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded">
                  <p className="font-medium text-blue-900">{getNextActionLabel(lead.next_action)}</p>
                  {lead.next_action_date && (
                    <p className="text-sm text-blue-700 mt-1">{formatDateTime(lead.next_action_date)}</p>
                  )}
                </div>
                <Button variant="outline" className="w-full" onClick={() => setShowActionModal(true)}>
                  Modifier
                </Button>
              </div>
            ) : (
              <Button className="w-full" onClick={() => setShowActionModal(true)}>
                + Définir une action
              </Button>
            )}
          </section>

          {/* Notes */}
          <section className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">📌 Notes</h2>
            <div className="text-gray-600 text-sm whitespace-pre-wrap">
              {lead.notes || 'Aucune note'}
            </div>
          </section>
        </div>
      </div>

      {/* Next Action Modal */}
      <Modal isOpen={showActionModal} onClose={() => setShowActionModal(false)} title="Définir prochaine action">
        <div className="space-y-4">
          <Select
            label="Type d'action"
            value={nextAction}
            onChange={(e) => setNextAction(e.target.value)}
            options={[
              { value: 'call_back', label: '📞 Rappeler' },
              { value: 'follow_up', label: '⏰ Relancer' },
              { value: 'send_proposal', label: '📄 Envoyer devis' },
              { value: 'meeting', label: '📅 RDV' },
            ]}
            placeholder="Sélectionner..."
          />
          <Input
            label="Date prévue"
            type="datetime-local"
            value={nextActionDate}
            onChange={(e) => setNextActionDate(e.target.value)}
          />
          <div className="flex justify-end gap-3 pt-4">
            <Button variant="outline" onClick={() => setShowActionModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleSetNextAction} disabled={!nextAction}>
              Enregistrer
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  )
}

// Info item component
function InfoItem({ icon, label, value, isLink = false }: {
  icon: string
  label: string
  value?: string | null
  isLink?: boolean
}) {
  if (!value) {
    return (
      <div className="flex items-start gap-2">
        <span>{icon}</span>
        <div>
          <div className="text-sm text-gray-500">{label}</div>
          <div className="text-gray-400">-</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <span>{icon}</span>
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        {isLink ? (
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
            {value}
          </a>
        ) : (
          <div className="text-gray-900">{value}</div>
        )}
      </div>
    </div>
  )
}
