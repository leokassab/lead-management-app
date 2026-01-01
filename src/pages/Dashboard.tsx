import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Badge, Button, Avatar } from '../components/ui'
import { useLeads, useDashboardStats } from '../hooks/useLeads'
import { useQueueLeads } from '../hooks/useQueueLeads'
import { useMeetings } from '../hooks/useMeetings'
import { useSLAAlerts } from '../hooks/useSLAAlerts'
import { useUserObjectives } from '../hooks/useUserObjectives'
import { formatDateTime } from '../utils/formatters'
import { getActionConfig } from '../types'
import type { Lead } from '../types'
import type { Meeting } from '../types/meetings'

export default function Dashboard() {
  const [period, setPeriod] = useState('month')
  const navigate = useNavigate()
  const { leads, statuses, loading } = useLeads({ period })
  const stats = useDashboardStats(leads, statuses)
  const { leads: queueLeads, stats: queueStats, loading: queueLoading } = useQueueLeads()
  const { meetings, todayMeetings, completeMeeting } = useMeetings()
  const { alerts: slaAlerts, alertCounts, isManager, loading: slaLoading } = useSLAAlerts()
  const {
    objectives,
    hasObjectives,
    daysRemaining,
    projectedCompletion,
    getProgressColor,
    getProgressTextColor,
    loading: objectivesLoading
  } = useUserObjectives()

  // Stats pour les actions du jour
  const actionStats = useMemo(() => {
    return {
      toCall: queueLeads.filter(l => l.current_action === 'call_today').length,
      toFollowUp: queueLeads.filter(l => l.current_action === 'follow_up').length,
      toEmail: queueLeads.filter(l => l.current_action === 'send_email').length,
      toSchedule: queueLeads.filter(l => l.current_action === 'schedule_meeting').length,
      toProposal: queueLeads.filter(l => l.current_action === 'send_proposal').length,
    }
  }, [queueLeads])

  // Stats RDV cette semaine
  const weekMeetingsStats = useMemo(() => {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Lundi
    startOfWeek.setHours(0, 0, 0, 0)
    const endOfWeek = new Date(startOfWeek)
    endOfWeek.setDate(startOfWeek.getDate() + 6)
    endOfWeek.setHours(23, 59, 59, 999)

    const weekMeetings = meetings.filter(m => {
      const meetingDate = new Date(m.scheduled_at)
      return meetingDate >= startOfWeek && meetingDate <= endOfWeek
    })

    return {
      total: weekMeetings.filter(m => m.status === 'scheduled' || m.status === 'confirmed' || m.status === 'completed').length,
      noShow: weekMeetings.filter(m => m.status === 'no_show').length,
    }
  }, [meetings])

  // Données pour le donut chart des actions
  const actionChartData = useMemo(() => {
    const actionCounts: Record<string, number> = {}
    queueLeads.forEach(lead => {
      const action = lead.current_action || 'none'
      actionCounts[action] = (actionCounts[action] || 0) + 1
    })

    return Object.entries(actionCounts)
      .map(([action, count]) => {
        const config = getActionConfig(action as Lead['current_action'])
        return {
          name: config.label,
          value: count,
          color: config.color.replace('text-', '').replace('-700', '-500'),
          icon: config.icon,
        }
      })
      .sort((a, b) => b.value - a.value)
      .slice(0, 6) // Top 6 actions
  }, [queueLeads])

  // Couleurs pour le donut
  const DONUT_COLORS = ['#22c55e', '#3b82f6', '#f97316', '#8b5cf6', '#06b6d4', '#eab308']

  // Top 5 leads urgents
  const urgentLeads = useMemo(() => {
    return queueLeads
      .filter(l => l.priority === 'urgent' || l.priority === 'hot')
      .slice(0, 5)
  }, [queueLeads])

  // Composant QuickLeadRow
  const QuickLeadRow = ({ lead }: { lead: Lead }) => {
    const actionConfig = getActionConfig(lead.current_action)
    return (
      <div
        onClick={() => navigate(`/leads/${lead.id}`)}
        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{actionConfig.icon}</span>
          <div>
            <span className="font-medium text-gray-900">
              {lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Sans nom'}
            </span>
            {lead.company_name && (
              <span className="text-gray-500 ml-2 text-sm">{lead.company_name}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lead.priority === 'urgent' && (
            <Badge variant="danger">Urgent</Badge>
          )}
          {lead.priority === 'hot' && (
            <Badge className="bg-orange-100 text-orange-700">Chaud</Badge>
          )}
        </div>
      </div>
    )
  }

  // Composant MeetingRow
  const MeetingRow = ({ meeting }: { meeting: Meeting }) => {
    const time = new Date(meeting.scheduled_at).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
    const leadName = meeting.lead?.full_name ||
      `${meeting.lead?.first_name || ''} ${meeting.lead?.last_name || ''}`.trim() ||
      'Lead inconnu'

    const handleComplete = async (e: React.MouseEvent) => {
      e.stopPropagation()
      await completeMeeting(meeting.id, { status: 'completed' })
    }

    const handleNoShow = async (e: React.MouseEvent) => {
      e.stopPropagation()
      await completeMeeting(meeting.id, { status: 'no_show' })
    }

    return (
      <div
        onClick={() => navigate(`/leads/${meeting.lead_id}`)}
        className="flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="text-lg font-semibold text-blue-600">{time}</div>
          <div>
            <span className="font-medium text-gray-900">{leadName}</span>
            <span className="text-gray-500 ml-2 text-sm">{meeting.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meeting.type === 'video' && meeting.location && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.open(meeting.location, '_blank')
              }}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Rejoindre
            </button>
          )}
          <button
            onClick={handleComplete}
            className="p-2 text-green-600 hover:bg-green-100 rounded"
            title="Marquer comme terminé"
          >
            ✅
          </button>
          <button
            onClick={handleNoShow}
            className="p-2 text-red-600 hover:bg-red-100 rounded"
            title="No-show"
          >
            ❌
          </button>
        </div>
      </div>
    )
  }

  const LeadCard = ({ lead, variant }: { lead: Lead; variant: 'urgent' | 'week' | 'standby' }) => {
    const variantStyles = {
      urgent: 'bg-red-50 border-l-4 border-red-500 hover:bg-red-100',
      week: 'bg-orange-50 border-l-4 border-orange-500 hover:bg-orange-100',
      standby: 'bg-gray-50 border-l-4 border-gray-400 hover:bg-gray-100',
    }

    return (
      <div
        onClick={() => navigate(`/leads/${lead.id}`)}
        className={`flex items-center justify-between p-4 rounded cursor-pointer transition-colors ${variantStyles[variant]}`}
      >
        <div>
          <span className="font-medium text-gray-900">{lead.full_name || `${lead.first_name} ${lead.last_name}`}</span>
          <span className="text-gray-500 ml-2">{lead.company_name}</span>
        </div>
        <div className="flex items-center gap-3">
          {lead.sector && (
            <Badge variant="outline">{lead.sector}</Badge>
          )}
          <span className="text-sm text-gray-600">
            {lead.current_action && getActionConfig(lead.current_action).label}
            {lead.current_action_date && ` - ${formatDateTime(lead.current_action_date)}`}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="today">Aujourd'hui</option>
          <option value="week">Cette semaine</option>
          <option value="month">Ce mois</option>
          <option value="last_month">Mois dernier</option>
        </select>
      </div>

      {loading || queueLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-500">Chargement...</div>
        </div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Total Leads</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalLeads}</div>
              <div className="text-sm text-green-600 mt-2">
                {stats.newCount} nouveaux cette période
              </div>
            </div>

            {/* KPI À traiter - Cliquable */}
            <div
              onClick={() => navigate('/queue')}
              className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                ⚡ À traiter
              </div>
              <div className="text-3xl font-bold text-orange-600">{queueLeads.length}</div>
              <div className="text-sm text-gray-500 mt-2">
                {queueStats.urgent} urgent{queueStats.urgent > 1 ? 's' : ''}
              </div>
            </div>

            {/* KPI RDV cette semaine */}
            <div
              onClick={() => navigate('/calendar')}
              className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
            >
              <div className="text-sm text-gray-500 mb-1 flex items-center gap-2">
                📅 RDV cette semaine
              </div>
              <div className="text-3xl font-bold text-blue-600">{weekMeetingsStats.total}</div>
              {weekMeetingsStats.noShow > 0 && (
                <div className="text-sm text-red-500 mt-2">
                  {weekMeetingsStats.noShow} no-show{weekMeetingsStats.noShow > 1 ? 's' : ''}
                </div>
              )}
              {weekMeetingsStats.noShow === 0 && (
                <div className="text-sm text-gray-500 mt-2">Aucun no-show</div>
              )}
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm text-gray-500 mb-1">Taux de conversion</div>
              <div className="text-3xl font-bold text-gray-900">
                {stats.conversionRate.toFixed(1)}%
              </div>
              <div className="text-sm text-green-600 mt-2">
                {stats.closingsCount} closing(s)
              </div>
            </div>
          </div>

          {/* Widget Mes Objectifs */}
          {!objectivesLoading && hasObjectives && objectives && (
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  🎯 Mes objectifs du mois
                </h2>
                <div className="text-sm text-gray-500">
                  {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} restant{daysRemaining > 1 ? 's' : ''}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Objectif Leads */}
                {objectives.monthly_lead_target > 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700">Leads</span>
                      <span className={`text-lg font-bold ${getProgressTextColor(objectives.lead_progress)}`}>
                        {objectives.current_leads} / {objectives.monthly_lead_target}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getProgressColor(objectives.lead_progress)}`}
                        style={{ width: `${Math.min(objectives.lead_progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                      <span>{objectives.lead_progress}% atteint</span>
                      <span>Projection: {projectedCompletion.leads} leads</span>
                    </div>
                  </div>
                )}

                {/* Objectif Closings */}
                {objectives.monthly_closing_target > 0 && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-700">Closings</span>
                      <span className={`text-lg font-bold ${getProgressTextColor(objectives.closing_progress)}`}>
                        {objectives.current_closings} / {objectives.monthly_closing_target}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getProgressColor(objectives.closing_progress)}`}
                        style={{ width: `${Math.min(objectives.closing_progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                      <span>{objectives.closing_progress}% atteint</span>
                      <span>Projection: {projectedCompletion.closings} closings</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Message d'encouragement */}
              <div className="mt-4 text-center">
                {objectives.lead_progress >= 100 && objectives.closing_progress >= 100 ? (
                  <div className="text-green-600 font-medium">
                    🎉 Felicitations ! Objectifs atteints !
                  </div>
                ) : objectives.lead_progress >= 80 || objectives.closing_progress >= 80 ? (
                  <div className="text-green-600 text-sm">
                    👏 Tres bien ! Continue comme ca !
                  </div>
                ) : objectives.lead_progress >= 50 || objectives.closing_progress >= 50 ? (
                  <div className="text-orange-600 text-sm">
                    💪 A mi-chemin, on accelere !
                  </div>
                ) : (
                  <div className="text-gray-500 text-sm">
                    🚀 C'est le moment de booster tes resultats !
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section Actions du jour */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              🎯 Actions du jour
            </h2>

            {/* Mini-stats cliquables */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
              <div
                onClick={() => navigate('/queue?action=call_today')}
                className="p-4 bg-green-50 rounded-lg cursor-pointer hover:bg-green-100 transition-colors text-center"
              >
                <div className="text-2xl mb-1">📞</div>
                <div className="text-2xl font-bold text-green-600">{actionStats.toCall}</div>
                <div className="text-xs text-gray-600">À appeler</div>
              </div>

              <div
                onClick={() => navigate('/queue?action=follow_up')}
                className="p-4 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100 transition-colors text-center"
              >
                <div className="text-2xl mb-1">🔁</div>
                <div className="text-2xl font-bold text-orange-600">{actionStats.toFollowUp}</div>
                <div className="text-xs text-gray-600">À relancer</div>
              </div>

              <div
                onClick={() => navigate('/queue?action=send_email')}
                className="p-4 bg-blue-50 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors text-center"
              >
                <div className="text-2xl mb-1">📧</div>
                <div className="text-2xl font-bold text-blue-600">{actionStats.toEmail}</div>
                <div className="text-xs text-gray-600">Emails</div>
              </div>

              <div
                onClick={() => navigate('/queue?action=schedule_meeting')}
                className="p-4 bg-indigo-50 rounded-lg cursor-pointer hover:bg-indigo-100 transition-colors text-center"
              >
                <div className="text-2xl mb-1">📅</div>
                <div className="text-2xl font-bold text-indigo-600">{actionStats.toSchedule}</div>
                <div className="text-xs text-gray-600">RDV à planifier</div>
              </div>

              <div
                onClick={() => navigate('/queue?action=send_proposal')}
                className="p-4 bg-cyan-50 rounded-lg cursor-pointer hover:bg-cyan-100 transition-colors text-center"
              >
                <div className="text-2xl mb-1">📄</div>
                <div className="text-2xl font-bold text-cyan-600">{actionStats.toProposal}</div>
                <div className="text-xs text-gray-600">Devis</div>
              </div>
            </div>

            {/* Leads urgents */}
            {urgentLeads.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Leads prioritaires</h3>
                {urgentLeads.map(lead => (
                  <QuickLeadRow key={lead.id} lead={lead} />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                Aucun lead urgent pour le moment
              </div>
            )}

            <button
              onClick={() => navigate('/queue')}
              className="w-full mt-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium"
            >
              Voir tout →
            </button>
          </div>

          {/* Section RDV du jour */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              📅 RDV du jour ({todayMeetings.length})
            </h2>

            {todayMeetings.length > 0 ? (
              <div className="space-y-2">
                {todayMeetings.map(meeting => (
                  <MeetingRow key={meeting.id} meeting={meeting} />
                ))}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-8">
                <div className="text-4xl mb-2">📅</div>
                <p>Aucun RDV aujourd'hui</p>
              </div>
            )}
          </div>

          {/* Widget Alertes Equipe - Managers/Admins seulement */}
          {isManager && !slaLoading && alertCounts.total > 0 && (
            <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <span className="text-red-500">⚠️</span> Alertes equipe
                <Badge variant="danger">{alertCounts.total}</Badge>
              </h2>

              {/* Stats rapides */}
              <div className="flex gap-4 mb-4">
                {alertCounts.breached > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
                    🚨 {alertCounts.breached} SLA depasse{alertCounts.breached > 1 ? 's' : ''}
                  </div>
                )}
                {alertCounts.warning > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
                    ⚠️ {alertCounts.warning} en alerte
                  </div>
                )}
              </div>

              {/* Liste des alertes */}
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {slaAlerts.slice(0, 10).map(alert => (
                  <div
                    key={alert.sla_id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      alert.alert_status === 'breached'
                        ? 'bg-red-50 hover:bg-red-100 border border-red-200'
                        : 'bg-yellow-50 hover:bg-yellow-100 border border-yellow-200'
                    }`}
                    onClick={() => navigate(`/leads/${alert.lead_id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={alert.user_avatar || undefined}
                        alt={`${alert.user_first_name} ${alert.user_last_name}`}
                        size="sm"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {alert.lead_name || 'Lead inconnu'}
                          </span>
                          <Badge
                            variant={alert.alert_status === 'breached' ? 'danger' : 'warning'}
                          >
                            {alert.alert_status === 'breached' ? '🚨 Depasse' : '⚠️ Bientot'}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-500">
                          Assign a {alert.user_first_name} {alert.user_last_name}
                          {' • '}
                          {alert.percentage_elapsed >= 100
                            ? `Depasse depuis ${Math.abs(Math.round(parseFloat(alert.time_remaining.split(':')[0])))}h`
                            : `${Math.round(100 - alert.percentage_elapsed)}% restant`
                          }
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          // TODO: Ouvrir modal de réassignation
                          navigate(`/leads/${alert.lead_id}`)
                        }}
                      >
                        Reassigner
                      </Button>
                      {alert.user_email && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.location.href = `mailto:${alert.user_email}?subject=SLA Alert: ${alert.lead_name}`
                          }}
                          title="Contacter le commercial"
                        >
                          ✉️
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {slaAlerts.length > 10 && (
                <div className="text-center mt-4 text-sm text-gray-500">
                  +{slaAlerts.length - 10} autres alertes
                </div>
              )}
            </div>
          )}

          {/* Graphiques */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Donut Chart des actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">📊 Répartition des actions</h3>
              {actionChartData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={actionChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {actionChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`${value} leads`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap justify-center gap-3 mt-2">
                    {actionChartData.map((item, index) => (
                      <div key={item.name} className="flex items-center gap-1 text-xs">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: DONUT_COLORS[index % DONUT_COLORS.length] }}
                        />
                        <span>{item.icon} {item.name} ({item.value})</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center text-gray-400">
                  Aucune donnée
                </div>
              )}
            </div>

            {/* Répartition par statut */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">📈 Répartition par statut</h3>
              <div className="h-64 overflow-y-auto">
                {statuses.length > 0 ? (
                  <div className="space-y-2 pr-2">
                    {statuses.map(status => {
                      const count = leads.filter(l => l.status === status.name).length
                      const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0
                      return (
                        <div key={status.id} className="flex items-center gap-3">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: status.color }}
                          />
                          <span className="text-sm flex-1 truncate">{status.name}</span>
                          <span className="text-sm font-medium">{count}</span>
                          <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                backgroundColor: status.color,
                                width: `${percentage}%`
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    Aucune donnée
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Mini KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Nouveaux</div>
              <div className="text-2xl font-bold text-blue-600">{stats.newCount}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Contactés</div>
              <div className="text-2xl font-bold text-orange-600">{stats.contactedCount}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">En cours</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.inProgressCount}</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-sm text-gray-500">Closings</div>
              <div className="text-2xl font-bold text-green-600">{stats.closingsCount}</div>
            </div>
          </div>

          {/* Leads à contacter */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              🎯 Leads à contacter ({stats.urgentLeads.length + stats.weekLeads.length + stats.standbyLeads.length})
            </h2>

            {/* URGENT */}
            <div className="mb-6">
              <h3 className="text-red-600 font-medium mb-3 flex items-center gap-2">
                🔴 URGENT - À contacter aujourd'hui ({stats.urgentLeads.length})
              </h3>
              {stats.urgentLeads.length > 0 ? (
                <div className="space-y-2">
                  {stats.urgentLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} variant="urgent" />
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded">
                  Aucun lead urgent pour le moment
                </div>
              )}
            </div>

            {/* Cette semaine */}
            <div className="mb-6">
              <h3 className="text-orange-600 font-medium mb-3 flex items-center gap-2">
                🟠 À traiter cette semaine ({stats.weekLeads.length})
              </h3>
              {stats.weekLeads.length > 0 ? (
                <div className="space-y-2">
                  {stats.weekLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} variant="week" />
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded">
                  Aucun lead à traiter cette semaine
                </div>
              )}
            </div>

            {/* Stand by */}
            <div>
              <h3 className="text-gray-600 font-medium mb-3 flex items-center gap-2">
                ⚪ Stand by - Reprendre contact ({stats.standbyLeads.length})
              </h3>
              {stats.standbyLeads.length > 0 ? (
                <div className="space-y-2">
                  {stats.standbyLeads.map(lead => (
                    <LeadCard key={lead.id} lead={lead} variant="standby" />
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-sm py-4 text-center bg-gray-50 rounded">
                  Aucun lead en stand by
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
