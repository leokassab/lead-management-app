import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../components/ui'
import { useLeads, useDashboardStats } from '../hooks/useLeads'
import { formatDateTime } from '../utils/formatters'
import { getNextActionLabel } from '../utils/helpers'
import type { Lead } from '../types'

export default function Dashboard() {
  const [period, setPeriod] = useState('month')
  const navigate = useNavigate()
  const { leads, statuses, loading } = useLeads({ period })
  const stats = useDashboardStats(leads, statuses)

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
            {lead.next_action && getNextActionLabel(lead.next_action)}
            {lead.next_action_date && ` - ${formatDateTime(lead.next_action_date)}`}
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

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-500">Chargement...</div>
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="text-sm text-gray-500 mb-1">Total Leads</div>
                <div className="text-3xl font-bold text-gray-900">{stats.totalLeads}</div>
                <div className="text-sm text-green-600 mt-2">
                  {stats.newCount} nouveaux cette période
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                <div className="text-sm text-gray-500 mb-1">Actions à faire</div>
                <div className="text-3xl font-bold text-orange-600">{stats.actionsCount}</div>
                <div className="text-sm text-gray-500 mt-2">Leads nécessitant une action</div>
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

            {/* Graphiques placeholder */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">📈 Évolution des leads</h3>
                <div className="h-48 flex items-center justify-center text-gray-400 bg-gray-50 rounded">
                  Graphique à venir (Recharts)
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="font-semibold mb-4">📊 Répartition par statut</h3>
                <div className="h-48 overflow-y-auto">
                  {statuses.length > 0 ? (
                    <div className="space-y-2 pr-2">
                      {statuses.map(status => {
                        const count = leads.filter(l => l.status === status.name).length
                        const percentage = leads.length > 0 ? (count / leads.length) * 100 : 0
                        return (
                          <div key={status.id} className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: status.color }}
                            />
                            <span className="text-sm flex-1">{status.name}</span>
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
          </>
        )}
    </div>
  )
}
