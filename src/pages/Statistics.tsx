import { useState, useMemo } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Button, Avatar, Badge } from '../components/ui'
import { useStatistics, calculateStats, type Period } from '../hooks/useStatistics'
import { formatCurrency } from '../utils/formatters'
import FunnelChart from '../components/stats/FunnelChart'
import LostReasonsChart, { DropOffChart } from '../components/stats/LostReasonsChart'
import { useSLAStats } from '../hooks/useSLATracking'
import { SLA_STATUS_COLORS } from '../types/sla'

type Tab = 'overview' | 'sources' | 'team' | 'quality' | 'funnel' | 'sla'

const PERIOD_LABELS: Record<Period, string> = {
  today: "Aujourd'hui",
  week: '7 jours',
  month: 'Ce mois',
  last_month: 'Mois dernier',
  quarter: 'Ce trimestre',
  year: 'Cette année',
}

const CHART_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1',
]

export default function Statistics() {
  const { leads, statuses, teamMembers, loading, period, setPeriod, dateRange } = useStatistics()
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const stats = useMemo(
    () => calculateStats(leads, statuses, teamMembers, dateRange),
    [leads, statuses, teamMembers, dateRange]
  )

  const formatChange = (value: number) => {
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}%`
  }

  const getChangeColor = (value: number) => {
    if (value > 0) return 'text-green-600'
    if (value < 0) return 'text-red-600'
    return 'text-gray-500'
  }

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Statistiques</h1>
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
              {(['today', 'week', 'month', 'last_month'] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                    period === p
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <Button variant="outline">
              📤 Exporter
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-6">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Vue d'ensemble
            </button>
            <button
              onClick={() => setActiveTab('sources')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'sources'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Source & Secteur
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'team'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Performance Commerciaux
            </button>
            <button
              onClick={() => setActiveTab('quality')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'quality'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Analyse Qualité
            </button>
            <button
              onClick={() => setActiveTab('funnel')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'funnel'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Funnel & Pertes
            </button>
            <button
              onClick={() => setActiveTab('sla')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'sla'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Délais & SLA
            </button>
          </nav>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Chargement des statistiques...
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* KPIs */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm mb-2">📈 Leads</h3>
                    <div className="text-3xl font-bold">{stats.totalLeads}</div>
                    <div className={`text-sm mt-2 ${getChangeColor(stats.leadsChange)}`}>
                      {formatChange(stats.leadsChange)} vs période précédente
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm mb-2">💰 Closings & CA</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Closings</span>
                        <span className="font-bold">{stats.closings}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>CA généré</span>
                        <span className="font-bold">{formatCurrency(stats.revenue)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Ticket moyen</span>
                        <span className="font-bold">{formatCurrency(stats.avgTicket)}</span>
                      </div>
                    </div>
                    <div className={`text-xs mt-2 ${getChangeColor(stats.revenueChange)}`}>
                      {formatChange(stats.revenueChange)} CA vs période précédente
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="text-gray-500 text-sm mb-2">⚡ Performance</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span>Taux de conversion</span>
                        <span className="font-bold">{stats.conversionRate.toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Temps moyen closing</span>
                        <span className="font-bold">{stats.avgClosingDays} jours</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Taux de contact</span>
                        <span className="font-bold">{stats.responseRate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Leads over time */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold mb-4">Évolution des leads</h3>
                    <div className="h-64">
                      {stats.leadsOverTime.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={stats.leadsOverTime}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Line
                              type="monotone"
                              dataKey="count"
                              stroke="#3B82F6"
                              strokeWidth={2}
                              dot={{ fill: '#3B82F6', r: 4 }}
                              name="Leads"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          Aucune donnée pour cette période
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Leads by status */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold mb-4">Répartition par statut</h3>
                    <div className="h-64">
                      {stats.leadsByStatus.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.leadsByStatus}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                              nameKey="name"
                              label={({ name, percent }) =>
                                `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                              }
                              labelLine={false}
                            >
                              {stats.leadsByStatus.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          Aucune donnée pour cette période
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Funnel */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">Funnel de conversion</h3>
                  <div className="grid grid-cols-6 gap-2">
                    {stats.funnel.map((stage, index) => (
                      <div key={stage.stage} className="text-center">
                        <div
                          className="mx-auto rounded-lg flex items-center justify-center text-white font-bold text-lg mb-2"
                          style={{
                            backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                            height: `${Math.max(40, stage.percentage * 1.5)}px`,
                            width: '100%',
                            opacity: 0.7 + (index * 0.05),
                          }}
                        >
                          {stage.count}
                        </div>
                        <div className="text-xs text-gray-600">{stage.stage}</div>
                        <div className="text-xs font-medium text-gray-900">
                          {stage.percentage.toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority distribution */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">Répartition par priorité</h3>
                  <div className="h-48">
                    {stats.leadsByPriority.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.leadsByPriority} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
                          <Tooltip />
                          <Bar dataKey="value" name="Leads" radius={[0, 4, 4, 0]}>
                            {stats.leadsByPriority.map((entry, index) => (
                              <Cell key={index} fill={entry.color} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        Aucune donnée
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Sources Tab */}
            {activeTab === 'sources' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* By source */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold mb-4">Leads par source</h3>
                    <div className="h-80">
                      {stats.leadsBySource.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.leadsBySource}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-45} textAnchor="end" height={80} />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#3B82F6" name="Leads" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          Aucune donnée
                        </div>
                      )}
                    </div>
                  </div>

                  {/* By sector */}
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold mb-4">Top 10 secteurs</h3>
                    <div className="h-80">
                      {stats.leadsBySector.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={stats.leadsBySector} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                            <XAxis type="number" tick={{ fontSize: 12 }} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                            <Tooltip />
                            <Bar dataKey="value" fill="#10B981" name="Leads" radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          Aucune donnée
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Source performance table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold">Performance par source</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-4 text-left text-sm font-medium text-gray-600">Source</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">Leads</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">% Total</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">Progression</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.leadsBySource.map((source, index) => (
                        <tr key={source.name} className="border-t">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                              />
                              <span className="font-medium">{source.name}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium">{source.value}</td>
                          <td className="p-4 text-right text-gray-500">
                            {((source.value / stats.totalLeads) * 100).toFixed(1)}%
                          </td>
                          <td className="p-4 text-right">
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="h-2 rounded-full"
                                style={{
                                  width: `${(source.value / Math.max(...stats.leadsBySource.map(s => s.value))) * 100}%`,
                                  backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Team Performance Tab */}
            {activeTab === 'team' && (
              <div className="space-y-6">
                {/* Team KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Commerciaux actifs</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.teamPerformance.filter(t => t.leads > 0).length}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Total closings</div>
                    <div className="text-2xl font-bold text-green-600">{stats.closings}</div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Moy. leads/commercial</div>
                    <div className="text-2xl font-bold text-orange-600">
                      {teamMembers.length > 0
                        ? (stats.totalLeads / teamMembers.length).toFixed(1)
                        : 0}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Meilleur taux conv.</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {Math.max(...stats.teamPerformance.map(t => t.conversionRate), 0).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Team performance chart */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">Comparaison équipe</h3>
                  <div className="h-80">
                    {stats.teamPerformance.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={stats.teamPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                          <XAxis
                            dataKey="user.first_name"
                            tick={{ fontSize: 12 }}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value, name) => {
                              if (name === 'CA') return formatCurrency(value as number)
                              return value
                            }}
                          />
                          <Legend />
                          <Bar dataKey="leads" fill="#3B82F6" name="Leads" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="contacted" fill="#F59E0B" name="Contactés" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="closings" fill="#10B981" name="Closings" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-gray-400">
                        Aucune donnée
                      </div>
                    )}
                  </div>
                </div>

                {/* Team table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="p-4 border-b">
                    <h3 className="font-semibold">Classement des commerciaux</h3>
                  </div>
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="p-4 text-left text-sm font-medium text-gray-600">#</th>
                        <th className="p-4 text-left text-sm font-medium text-gray-600">Commercial</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">Leads</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">Contactés</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">Closings</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">CA</th>
                        <th className="p-4 text-right text-sm font-medium text-gray-600">Taux conv.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.teamPerformance.map((member, index) => (
                        <tr key={member.user.id} className="border-t hover:bg-gray-50">
                          <td className="p-4">
                            {index === 0 && <span className="text-xl">🥇</span>}
                            {index === 1 && <span className="text-xl">🥈</span>}
                            {index === 2 && <span className="text-xl">🥉</span>}
                            {index > 2 && <span className="text-gray-400">{index + 1}</span>}
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar
                                src={member.user.avatar_url}
                                alt={`${member.user.first_name} ${member.user.last_name}`}
                                size="sm"
                              />
                              <div>
                                <div className="font-medium">
                                  {member.user.first_name} {member.user.last_name}
                                </div>
                                <div className="text-xs text-gray-500">{member.user.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium">{member.leads}</td>
                          <td className="p-4 text-right">{member.contacted}</td>
                          <td className="p-4 text-right">
                            <Badge variant={member.closings > 0 ? 'success' : 'default'}>
                              {member.closings}
                            </Badge>
                          </td>
                          <td className="p-4 text-right font-medium text-green-600">
                            {formatCurrency(member.revenue)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-gray-200 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full bg-blue-600"
                                  style={{ width: `${Math.min(member.conversionRate, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-12">
                                {member.conversionRate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Quality Analysis Tab */}
            {activeTab === 'quality' && (
              <div className="space-y-6">
                {/* Quality KPIs */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Leads urgent/hot</div>
                    <div className="text-2xl font-bold text-red-600">
                      {stats.leadsByPriority.find(p => p.name === 'Urgent')?.value || 0}
                      {' + '}
                      {stats.leadsByPriority.find(p => p.name === 'Hot')?.value || 0}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Leads qualifiés</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.leadsByStatus.find(s => s.name === 'Qualifié')?.value || 0}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Taux qualification</div>
                    <div className="text-2xl font-bold text-green-600">
                      {stats.totalLeads > 0
                        ? (
                            ((stats.leadsByStatus.find(s => s.name === 'Qualifié')?.value || 0) /
                              stats.totalLeads) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </div>
                  </div>
                  <div className="bg-white rounded-lg shadow p-4">
                    <div className="text-sm text-gray-500">Leads perdus</div>
                    <div className="text-2xl font-bold text-gray-600">
                      {stats.leadsByStatus.find(s => s.name === 'Perdu')?.value || 0}
                    </div>
                  </div>
                </div>

                {/* Quality distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold mb-4">Qualité des leads (priorité)</h3>
                    <div className="h-64">
                      {stats.leadsByPriority.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={stats.leadsByPriority}
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              dataKey="value"
                              nameKey="name"
                              label={({ name, value }) => `${name}: ${value}`}
                            >
                              {stats.leadsByPriority.map((entry, index) => (
                                <Cell key={index} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">
                          Aucune donnée
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white rounded-lg shadow p-6">
                    <h3 className="font-semibold mb-4">Taux de conversion par étape</h3>
                    <div className="space-y-4">
                      {stats.funnel.map((stage, index) => (
                        <div key={stage.stage}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium">{stage.stage}</span>
                            <span className="text-gray-500">
                              {stage.count} ({stage.percentage.toFixed(1)}%)
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                              className="h-3 rounded-full transition-all"
                              style={{
                                width: `${stage.percentage}%`,
                                backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="font-semibold mb-4">Insights</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <div className="text-blue-600 font-medium mb-1">Source la plus performante</div>
                      <div className="text-lg font-bold">
                        {stats.leadsBySource[0]?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {stats.leadsBySource[0]?.value || 0} leads
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="text-green-600 font-medium mb-1">Secteur le plus actif</div>
                      <div className="text-lg font-bold">
                        {stats.leadsBySector[0]?.name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {stats.leadsBySector[0]?.value || 0} leads
                      </div>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <div className="text-purple-600 font-medium mb-1">Meilleur commercial</div>
                      <div className="text-lg font-bold">
                        {stats.teamPerformance[0]?.user.first_name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {stats.teamPerformance[0]?.closings || 0} closings
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Funnel & Pertes Tab */}
            {activeTab === 'funnel' && (
              <FunnelTab leads={leads} />
            )}

            {/* Délais & SLA Tab */}
            {activeTab === 'sla' && (
              <SLATab teamMembers={teamMembers} />
            )}
          </>
        )}
    </div>
  )
}

// Separate component for Funnel Tab to handle calculations
function FunnelTab({
  leads,
}: {
  leads: ReturnType<typeof useStatistics>['leads']
}) {
  // Calculate funnel stages with colors for FunnelChart
  const funnelStages = useMemo(() => {
    const stageColors = [
      '#3B82F6', // blue - Leads
      '#8B5CF6', // violet - Contacté
      '#F59E0B', // amber - RDV
      '#06B6D4', // cyan - Proposition
      '#10B981', // green - Gagné
    ]

    const stages = [
      { name: 'Leads', statusFilters: ['Opt-in', 'new', 'Contacté', 'Qualifié', 'RDV obtenu', 'Proposition envoyée', 'Négociation', 'Gagné'] },
      { name: 'Contactés', statusFilters: ['Contacté', 'Qualifié', 'RDV obtenu', 'Proposition envoyée', 'Négociation', 'Gagné'] },
      { name: 'RDV obtenus', statusFilters: ['RDV obtenu', 'Proposition envoyée', 'Négociation', 'Gagné'] },
      { name: 'Propositions', statusFilters: ['Proposition envoyée', 'Négociation', 'Gagné'] },
      { name: 'Gagnés', statusFilters: ['Gagné'] },
    ]

    const totalLeads = leads.length || 1

    return stages.map((stage, index) => {
      const count = leads.filter(l => stage.statusFilters.includes(l.status)).length
      return {
        name: stage.name,
        count,
        percentage: (count / totalLeads) * 100,
        color: stageColors[index],
      }
    })
  }, [leads])

  // Calculate drop-off data
  const dropOffData = useMemo(() => {
    const transitions = [
      { fromStage: 'Leads', toStage: 'Contactés' },
      { fromStage: 'Contactés', toStage: 'RDV obtenus' },
      { fromStage: 'RDV obtenus', toStage: 'Propositions' },
      { fromStage: 'Propositions', toStage: 'Gagnés' },
    ]

    return transitions.map(t => {
      const fromCount = funnelStages.find(s => s.name === t.fromStage)?.count || 0
      const toCount = funnelStages.find(s => s.name === t.toStage)?.count || 0
      const lostCount = fromCount - toCount

      return {
        fromStage: t.fromStage,
        toStage: t.toStage,
        lostCount,
        percentage: fromCount > 0 ? (lostCount / fromCount) * 100 : 0,
      }
    }).filter(d => d.lostCount > 0)
  }, [funnelStages])

  // Calculate lost reasons data
  const lostReasonsData = useMemo(() => {
    const lostLeads = leads.filter(l => l.status === 'Perdu')
    const reasonMap = new Map<string, number>()

    lostLeads.forEach(lead => {
      const reason = lead.lost_reason || 'other'
      reasonMap.set(reason, (reasonMap.get(reason) || 0) + 1)
    })

    const total = lostLeads.length || 1

    return Array.from(reasonMap.entries())
      .map(([reason, count]) => ({
        reason,
        count,
        percentage: (count / total) * 100,
      }))
      .sort((a, b) => b.count - a.count)
  }, [leads])

  // Stats for the lost leads section
  const lostStats = useMemo(() => {
    const lostLeads = leads.filter(l => l.status === 'Perdu')
    const totalLeads = leads.length || 1
    const totalLost = lostLeads.length
    const lostRevenue = lostLeads.reduce((sum, l) => sum + (l.deal_value || 0), 0)

    return {
      totalLost,
      lostPercentage: (totalLost / totalLeads) * 100,
      lostRevenue,
    }
  }, [leads])

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Taux de conversion global</div>
          <div className="text-2xl font-bold text-green-600">
            {funnelStages.length > 0 ? funnelStages[funnelStages.length - 1].percentage.toFixed(1) : 0}%
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {funnelStages[funnelStages.length - 1]?.count || 0} / {funnelStages[0]?.count || 0} leads
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Leads perdus</div>
          <div className="text-2xl font-bold text-red-600">
            {lostStats.totalLost}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {lostStats.lostPercentage.toFixed(1)}% du total
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">CA perdu estimé</div>
          <div className="text-2xl font-bold text-orange-600">
            {formatCurrency(lostStats.lostRevenue)}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-500">Plus grosse perte</div>
          <div className="text-2xl font-bold text-gray-700">
            {dropOffData.length > 0
              ? dropOffData.reduce((max, d) => d.lostCount > max.lostCount ? d : max, dropOffData[0]).fromStage
              : 'N/A'}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {dropOffData.length > 0
              ? `${dropOffData.reduce((max, d) => d.lostCount > max.lostCount ? d : max, dropOffData[0]).percentage.toFixed(1)}% perdus`
              : ''}
          </div>
        </div>
      </div>

      {/* Funnel Visual */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Funnel de conversion</h3>
        <p className="text-sm text-gray-500 mb-4">
          Visualisation des leads à chaque étape du processus de vente
        </p>
        <FunnelChart stages={funnelStages} showDropOff={true} />
      </div>

      {/* Where do we lose leads */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-2">Où perd-on les leads ?</h3>
        <p className="text-sm text-gray-500 mb-4">
          Analyse des transitions où les leads sont perdus dans le funnel
        </p>
        {dropOffData.length > 0 ? (
          <DropOffChart data={dropOffData} />
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400">
            Pas de données de perte disponibles
          </div>
        )}
      </div>

      {/* Lost reasons */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-2">Raisons de perte</h3>
        <p className="text-sm text-gray-500 mb-4">
          Répartition des leads perdus par raison
        </p>
        {lostReasonsData.length > 0 ? (
          <LostReasonsChart data={lostReasonsData} showTable={true} />
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400">
            Aucun lead perdu avec raison renseignée
          </div>
        )}
      </div>

      {/* Insights */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Recommandations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dropOffData.length > 0 && (
            <>
              {dropOffData.sort((a, b) => b.percentage - a.percentage).slice(0, 2).map((drop, index) => (
                <div key={index} className={`p-4 rounded-lg ${index === 0 ? 'bg-red-50' : 'bg-orange-50'}`}>
                  <div className={`font-medium mb-1 ${index === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                    {index === 0 ? '🚨 Point critique' : '⚠️ À surveiller'}
                  </div>
                  <div className="text-sm text-gray-700">
                    <strong>{drop.percentage.toFixed(0)}%</strong> des leads sont perdus entre{' '}
                    <strong>{drop.fromStage}</strong> et <strong>{drop.toStage}</strong>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {drop.lostCount} leads concernés
                  </div>
                </div>
              ))}
            </>
          )}
          {lostReasonsData.length > 0 && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="font-medium mb-1 text-blue-600">
                📊 Raison principale de perte
              </div>
              <div className="text-sm text-gray-700">
                <strong>{lostReasonsData[0].percentage.toFixed(0)}%</strong> des pertes sont dues à{' '}
                "<strong>{getLostReasonLabel(lostReasonsData[0].reason)}</strong>"
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {lostReasonsData[0].count} leads concernés
              </div>
            </div>
          )}
          {funnelStages.length > 0 && funnelStages[funnelStages.length - 1].percentage > 0 && (
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="font-medium mb-1 text-green-600">
                ✅ Performance
              </div>
              <div className="text-sm text-gray-700">
                Taux de conversion de <strong>{funnelStages[funnelStages.length - 1].percentage.toFixed(1)}%</strong>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {funnelStages[funnelStages.length - 1].count} leads convertis sur {funnelStages[0].count}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function getLostReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    'budget': 'Budget insuffisant',
    'timing': 'Mauvais timing',
    'competitor': 'Choix concurrent',
    'no_need': 'Pas de besoin',
    'no_response': 'Sans réponse',
    'not_qualified': 'Non qualifié',
    'other': 'Autre',
  }
  return labels[reason] || reason
}

// SLA Tab Component
function SLATab({ teamMembers }: { teamMembers: ReturnType<typeof useStatistics>['teamMembers'] }) {
  const { overviewStats, statsByUser, statsBySource, loading } = useSLAStats()

  // Enrich statsByUser with team member data
  const enrichedStatsByUser = useMemo(() => {
    return statsByUser.map(stat => {
      const member = teamMembers.find(m => m.id === stat.user_id)
      return {
        ...stat,
        first_name: member?.first_name || 'Inconnu',
        last_name: member?.last_name || '',
        avatar_url: member?.avatar_url,
      }
    }).sort((a, b) => (b.sla_met_percentage || 0) - (a.sla_met_percentage || 0))
  }, [statsByUser, teamMembers])

  const formatHours = (hours: number | null): string => {
    if (hours === null) return '-'
    if (hours < 1) return `${Math.round(hours * 60)} min`
    if (hours < 24) return `${hours.toFixed(1)}h`
    return `${(hours / 24).toFixed(1)}j`
  }

  const formatSource = (source: string): string => {
    const labels: Record<string, string> = {
      manual: 'Saisie manuelle',
      import_csv: 'Import CSV',
      import_excel: 'Import Excel',
      web_form: 'Formulaire web',
      email: 'Email',
      api: 'API',
    }
    return labels[source] || source
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        Chargement des statistiques SLA...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
              <span className="text-2xl">⏱️</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">Temps moyen 1er contact</div>
              <div className="text-2xl font-bold text-blue-600">
                {formatHours(overviewStats.avgFirstContactHours)}
              </div>
              <div className="text-xs text-gray-400">
                Médiane: {formatHours(overviewStats.medianFirstContactHours)}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-2xl">✅</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">% SLA respecté</div>
              <div className="text-2xl font-bold text-green-600">
                {overviewStats.slaMetPercentage.toFixed(1)}%
              </div>
              <div className="text-xs text-gray-400">
                {overviewStats.slaMet} / {overviewStats.slaMet + overviewStats.slaBreached} SLA
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-2xl">🚨</span>
            </div>
            <div>
              <div className="text-sm text-gray-500">SLA dépassés</div>
              <div className="text-2xl font-bold text-red-600">
                {overviewStats.slaBreached}
              </div>
              <div className="text-xs text-gray-400">
                + {overviewStats.slaPending} en attente
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SLA Distribution Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-4">Répartition des SLA</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Pie Chart */}
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Respecté', value: overviewStats.slaMet, color: SLA_STATUS_COLORS.met },
                    { name: 'Dépassé', value: overviewStats.slaBreached, color: SLA_STATUS_COLORS.breached },
                    { name: 'En attente', value: overviewStats.slaPending, color: SLA_STATUS_COLORS.pending },
                  ].filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {[
                    { color: SLA_STATUS_COLORS.met },
                    { color: SLA_STATUS_COLORS.breached },
                    { color: SLA_STATUS_COLORS.pending },
                  ].map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Stats Summary */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SLA_STATUS_COLORS.met }} />
                <span className="font-medium text-green-700">SLA Respectés</span>
              </div>
              <span className="text-xl font-bold text-green-600">{overviewStats.slaMet}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SLA_STATUS_COLORS.breached }} />
                <span className="font-medium text-red-700">SLA Dépassés</span>
              </div>
              <span className="text-xl font-bold text-red-600">{overviewStats.slaBreached}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: SLA_STATUS_COLORS.pending }} />
                <span className="font-medium text-amber-700">En attente</span>
              </div>
              <span className="text-xl font-bold text-amber-600">{overviewStats.slaPending}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance by User Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Performance par commercial</h3>
          <p className="text-sm text-gray-500 mt-1">
            Temps de réponse et respect des SLA par membre de l'équipe
          </p>
        </div>
        {enrichedStatsByUser.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-left text-sm font-medium text-gray-600">Commercial</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">Temps moyen</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">Temps médian</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">% SLA respecté</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">En retard</th>
              </tr>
            </thead>
            <tbody>
              {enrichedStatsByUser.map((member) => (
                <tr key={member.user_id} className="border-t hover:bg-gray-50">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar
                        src={member.avatar_url}
                        alt={`${member.first_name} ${member.last_name}`}
                        size="sm"
                      />
                      <div>
                        <div className="font-medium">
                          {member.first_name} {member.last_name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {member.total_sla} leads traités
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-right">
                    <span className="font-medium">
                      {formatHours(member.avg_response_hours)}
                    </span>
                  </td>
                  <td className="p-4 text-right text-gray-600">
                    {formatHours(member.median_response_hours)}
                  </td>
                  <td className="p-4 text-right">
                    {member.sla_met_percentage !== null ? (
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full"
                            style={{
                              width: `${Math.min(member.sla_met_percentage, 100)}%`,
                              backgroundColor: member.sla_met_percentage >= 80
                                ? SLA_STATUS_COLORS.met
                                : member.sla_met_percentage >= 50
                                  ? SLA_STATUS_COLORS.pending
                                  : SLA_STATUS_COLORS.breached,
                            }}
                          />
                        </div>
                        <span className="font-medium w-12">
                          {member.sla_met_percentage.toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {member.sla_breached > 0 ? (
                      <Badge variant="danger">{member.sla_breached}</Badge>
                    ) : (
                      <Badge variant="success">0</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Aucune donnée SLA disponible
          </div>
        )}
      </div>

      {/* Response Time by Source */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold mb-2">Temps de prise en charge par source</h3>
        <p className="text-sm text-gray-500 mb-4">
          Temps moyen entre l'arrivée du lead et le premier contact
        </p>
        {statsBySource.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statsBySource.slice(0, 10).map(s => ({
                  source: formatSource(s.source),
                  avgHours: s.avg_response_hours || 0,
                  leads: s.total_leads,
                }))}
                layout="vertical"
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) => formatHours(v)}
                />
                <YAxis
                  dataKey="source"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={120}
                />
                <Tooltip
                  formatter={(value) => [formatHours(Number(value)), 'Temps moyen']}
                  labelFormatter={(label) => `Source: ${label}`}
                />
                <Bar
                  dataKey="avgHours"
                  fill="#3B82F6"
                  name="Temps moyen"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-400">
            Aucune donnée disponible
          </div>
        )}
      </div>

      {/* Source Performance Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Détail par source</h3>
        </div>
        {statsBySource.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-left text-sm font-medium text-gray-600">Source</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">Leads</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">Temps moyen</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">Temps médian</th>
                <th className="p-4 text-right text-sm font-medium text-gray-600">% SLA</th>
              </tr>
            </thead>
            <tbody>
              {statsBySource.map((source) => (
                <tr key={source.source} className="border-t hover:bg-gray-50">
                  <td className="p-4 font-medium">{formatSource(source.source)}</td>
                  <td className="p-4 text-right">{source.total_leads}</td>
                  <td className="p-4 text-right font-medium">
                    {formatHours(source.avg_response_hours)}
                  </td>
                  <td className="p-4 text-right text-gray-600">
                    {formatHours(source.median_response_hours)}
                  </td>
                  <td className="p-4 text-right">
                    {source.sla_met_percentage !== null ? (
                      <span
                        className="font-medium"
                        style={{
                          color: source.sla_met_percentage >= 80
                            ? SLA_STATUS_COLORS.met
                            : source.sla_met_percentage >= 50
                              ? SLA_STATUS_COLORS.pending
                              : SLA_STATUS_COLORS.breached,
                        }}
                      >
                        {source.sla_met_percentage.toFixed(0)}%
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            Aucune donnée disponible
          </div>
        )}
      </div>
    </div>
  )
}
