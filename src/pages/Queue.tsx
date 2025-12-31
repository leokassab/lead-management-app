import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueueLeads, type QueueFilter } from '../hooks/useQueueLeads'
import { ActionBadge } from '../components/actions'
import { FocusMode } from '../components/queue'
import type { Lead, LeadAction } from '../types'

export default function Queue() {
  const navigate = useNavigate()
  const [focusModeOpen, setFocusModeOpen] = useState(false)
  const {
    filteredLeads,
    stats,
    loading,
    filter,
    setFilter,
    updateLeadAction,
  } = useQueueLeads()

  const filters: { key: QueueFilter; label: string; icon: string }[] = [
    { key: 'all', label: 'Tous', icon: '📋' },
    { key: 'call', label: 'À appeler', icon: '📞' },
    { key: 'follow_up', label: 'À relancer', icon: '🔁' },
    { key: 'email', label: 'Email', icon: '📧' },
  ]

  const getPriorityIndicator = (priority: Lead['priority']) => {
    switch (priority) {
      case 'urgent': return { color: '🔴', bg: 'bg-red-100' }
      case 'hot': return { color: '🟠', bg: 'bg-orange-100' }
      case 'warm': return { color: '🟡', bg: 'bg-yellow-100' }
      default: return { color: '⚪', bg: 'bg-gray-100' }
    }
  }

  const getLeadName = (lead: Lead) => {
    if (lead.full_name) return lead.full_name
    if (lead.first_name || lead.last_name) {
      return `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    }
    return lead.email || 'Sans nom'
  }

  const handleQuickAction = async (lead: Lead, action: LeadAction) => {
    const today = new Date().toISOString()
    await updateLeadAction(lead.id, action, today)
  }

  const handleCall = (lead: Lead) => {
    if (lead.phone) {
      window.open(`tel:${lead.phone}`, '_self')
      handleQuickAction(lead, 'waiting_response')
    }
  }

  const handleEmail = (lead: Lead) => {
    if (lead.email) {
      window.open(`mailto:${lead.email}`, '_blank')
      handleQuickAction(lead, 'waiting_response')
    }
  }

  const handleWhatsApp = (lead: Lead) => {
    if (lead.phone) {
      const phone = lead.phone.replace(/\D/g, '')
      window.open(`https://wa.me/${phone}`, '_blank')
      handleQuickAction(lead, 'waiting_response')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Chargement de votre queue...</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Mes leads à traiter
              <span className="ml-2 text-lg font-normal text-gray-500">
                ({filteredLeads.length})
              </span>
            </h1>
            <p className="text-gray-500 mt-1">
              Triés par priorité, date d'action et score IA
            </p>
          </div>

          <button
            onClick={() => setFocusModeOpen(true)}
            disabled={filteredLeads.length === 0}
            className={`
              px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2
              ${filteredLeads.length > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }
            `}
          >
            🎯 Mode focus
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📞</span>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.toCall}</div>
                <div className="text-sm text-gray-500">À appeler</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔁</span>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.toFollowUp}</div>
                <div className="text-sm text-gray-500">À relancer</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏳</span>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.waiting}</div>
                <div className="text-sm text-gray-500">En attente</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔥</span>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats.urgent}</div>
                <div className="text-sm text-gray-500">Urgents</div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
                ${filter === f.key
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }
              `}
            >
              <span>{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>

        {/* Leads List */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {filteredLeads.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-medium text-gray-900">Queue vide !</h3>
              <p className="text-gray-500 mt-1">
                {filter === 'all'
                  ? "Aucun lead à traiter pour le moment"
                  : "Aucun lead dans cette catégorie"
                }
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredLeads.map((lead, index) => {
                const priority = getPriorityIndicator(lead.priority)
                const isOverdue = lead.current_action_date && new Date(lead.current_action_date) < new Date()

                return (
                  <div
                    key={lead.id}
                    className={`
                      p-4 hover:bg-gray-50 transition-colors
                      ${isOverdue ? 'bg-red-50/50' : ''}
                    `}
                  >
                    <div className="flex items-center gap-4">
                      {/* Position */}
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-500">
                        #{index + 1}
                      </div>

                      {/* Priority Indicator */}
                      <div className="flex-shrink-0 text-lg">
                        {priority.color}
                      </div>

                      {/* Lead Info */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => navigate(`/leads/${lead.id}`)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {getLeadName(lead)}
                          </span>
                          {lead.company_name && (
                            <span className="text-gray-500 truncate">
                              • {lead.company_name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {lead.sector && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {lead.sector}
                            </span>
                          )}
                          {lead.email && (
                            <span className="text-xs text-gray-400 truncate">
                              {lead.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Action Badge */}
                      <div className="flex-shrink-0 hidden sm:block">
                        <ActionBadge
                          action={lead.current_action}
                          actionDate={lead.current_action_date}
                          showDate
                          size="sm"
                        />
                      </div>

                      {/* AI Score */}
                      {lead.ai_score !== undefined && lead.ai_score !== null && (
                        <div className="flex-shrink-0 hidden md:flex items-center gap-1">
                          <span className="text-sm text-gray-400">IA</span>
                          <span className={`
                            text-sm font-semibold
                            ${lead.ai_score >= 80 ? 'text-green-600' : ''}
                            ${lead.ai_score >= 50 && lead.ai_score < 80 ? 'text-yellow-600' : ''}
                            ${lead.ai_score < 50 ? 'text-gray-400' : ''}
                          `}>
                            {lead.ai_score}%
                          </span>
                        </div>
                      )}

                      {/* Quick Actions */}
                      <div className="flex-shrink-0 flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCall(lead) }}
                          disabled={!lead.phone}
                          className={`
                            p-2 rounded-lg transition-colors
                            ${lead.phone
                              ? 'hover:bg-green-100 text-green-600'
                              : 'text-gray-300 cursor-not-allowed'
                            }
                          `}
                          title={lead.phone ? `Appeler ${lead.phone}` : 'Pas de téléphone'}
                        >
                          📞
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleEmail(lead) }}
                          disabled={!lead.email}
                          className={`
                            p-2 rounded-lg transition-colors
                            ${lead.email
                              ? 'hover:bg-blue-100 text-blue-600'
                              : 'text-gray-300 cursor-not-allowed'
                            }
                          `}
                          title={lead.email ? `Email ${lead.email}` : 'Pas d\'email'}
                        >
                          📧
                        </button>

                        <button
                          onClick={(e) => { e.stopPropagation(); handleWhatsApp(lead) }}
                          disabled={!lead.phone}
                          className={`
                            p-2 rounded-lg transition-colors
                            ${lead.phone
                              ? 'hover:bg-emerald-100 text-emerald-600'
                              : 'text-gray-300 cursor-not-allowed'
                            }
                          `}
                          title={lead.phone ? 'WhatsApp' : 'Pas de téléphone'}
                        >
                          💬
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/leads/${lead.id}`)
                          }}
                          className="p-2 rounded-lg hover:bg-indigo-100 text-indigo-600 transition-colors"
                          title="Voir détails"
                        >
                          📅
                        </button>
                      </div>
                    </div>

                    {/* Mobile: Action Badge */}
                    <div className="mt-3 sm:hidden">
                      <ActionBadge
                        action={lead.current_action}
                        actionDate={lead.current_action_date}
                        showDate
                        size="sm"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Focus Mode */}
      {focusModeOpen && (
        <FocusMode
          leads={filteredLeads}
          onClose={() => setFocusModeOpen(false)}
          onUpdateAction={updateLeadAction}
        />
      )}
    </>
  )
}
