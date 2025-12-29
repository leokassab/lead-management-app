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
import { Layout } from '../components/layout'
import { Button, Avatar, Badge } from '../components/ui'
import { useStatistics, calculateStats, type Period } from '../hooks/useStatistics'
import { formatCurrency } from '../utils/formatters'

type Tab = 'overview' | 'sources' | 'team' | 'quality'

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
    <Layout>
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
          </>
        )}
      </div>
    </Layout>
  )
}
