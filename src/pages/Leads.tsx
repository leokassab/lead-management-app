import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Avatar } from '../components/ui'
import { ActionBadge } from '../components/actions'
import LeadForm from '../components/leads/LeadForm'
import ImportModal from '../components/leads/ImportModal'
import { LostReasonModal } from '../components/leads'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useLeads } from '../hooks/useLeads'
import { useLeadsInSequences } from '../hooks/useLeadSequence'
import { isLostStatus } from '../hooks/useLostReasons'
import { formatDate } from '../utils/formatters'
import type { Lead, User } from '../types'
import { LEAD_ACTIONS } from '../types'

type PeriodFilter = 'today' | 'week' | 'month' | 'all'

const ITEMS_PER_PAGE = 20

export default function Leads() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { leads, statuses, loading, refetch } = useLeads()

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<User[]>([])

  // Period filter
  const [period, setPeriod] = useState<PeriodFilter>('month')

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [priorityFilter, setPriorityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [assigneeFilter, setAssigneeFilter] = useState('')

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)

  // Selection
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])

  // Modals
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [showLostModal, setShowLostModal] = useState(false)
  const [pendingBulkLostStatus, setPendingBulkLostStatus] = useState('')

  // Dropdown states
  const [showStatusDropdown, setShowStatusDropdown] = useState(false)
  const [showTagDropdown, setShowTagDropdown] = useState(false)

  // Fetch team members
  useEffect(() => {
    if (profile?.team_id) {
      supabase
        .from('users')
        .select('*')
        .eq('team_id', profile.team_id)
        .then(({ data }) => {
          if (data) setTeamMembers(data)
        })
    }
  }, [profile])

  // Get all unique tags from leads
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    leads.forEach(lead => {
      lead.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [leads])

  // Filter by period first
  const periodFilteredLeads = useMemo(() => {
    const now = new Date()
    let startDate: Date

    switch (period) {
      case 'today':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        break
      case 'week':
        startDate = new Date(now)
        startDate.setDate(now.getDate() - 7)
        break
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'all':
      default:
        return leads
    }

    return leads.filter(lead => new Date(lead.created_at) >= startDate)
  }, [leads, period])

  // Apply all filters
  const filteredLeads = useMemo(() => {
    return periodFilteredLeads.filter(lead => {
      // Search
      if (search) {
        const searchLower = search.toLowerCase()
        const matchesSearch =
          lead.full_name?.toLowerCase().includes(searchLower) ||
          lead.first_name?.toLowerCase().includes(searchLower) ||
          lead.last_name?.toLowerCase().includes(searchLower) ||
          lead.email?.toLowerCase().includes(searchLower) ||
          lead.company_name?.toLowerCase().includes(searchLower) ||
          lead.phone?.includes(search)

        if (!matchesSearch) return false
      }

      // Status filter (multi-select)
      if (statusFilter.length > 0 && !statusFilter.includes(lead.status)) return false

      // Priority filter
      if (priorityFilter && lead.priority !== priorityFilter) return false

      // Action filter
      if (actionFilter && lead.current_action !== actionFilter) return false

      // Tag filter (multi-select - lead must have at least one of the selected tags)
      if (tagFilter.length > 0) {
        const hasTag = lead.tags?.some(tag => tagFilter.includes(tag))
        if (!hasTag) return false
      }

      // Assignee filter
      if (assigneeFilter && lead.assigned_to !== assigneeFilter) return false

      return true
    })
  }, [periodFilteredLeads, search, statusFilter, priorityFilter, actionFilter, tagFilter, assigneeFilter])

  // Pagination
  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE)
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return filteredLeads.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredLeads, currentPage])

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [search, statusFilter, priorityFilter, actionFilter, tagFilter, assigneeFilter, period])

  // Stats (based on period-filtered leads)
  const stats = useMemo(() => {
    const newStatus = statuses.find(s => s.name === 'Opt-in')
    const contactedStatus = statuses.find(s => s.name === 'Contacté')
    const wonStatus = statuses.find(s => s.name === 'Gagné')

    return {
      new: periodFilteredLeads.filter(l => l.status === newStatus?.name || l.status === 'new').length,
      contacted: periodFilteredLeads.filter(l => l.status === contactedStatus?.name).length,
      inProgress: periodFilteredLeads.filter(l =>
        l.status !== newStatus?.name &&
        l.status !== wonStatus?.name &&
        l.status !== 'Perdu' &&
        l.status !== 'new'
      ).length,
      closings: periodFilteredLeads.filter(l => l.status === wonStatus?.name).length,
    }
  }, [periodFilteredLeads, statuses])

  // Get leads in sequences
  const leadIds = useMemo(() => paginatedLeads.map(l => l.id), [paginatedLeads])
  const { sequenceMap } = useLeadsInSequences(leadIds)

  // Handlers
  const handleSelectAll = () => {
    if (selectedLeads.length === paginatedLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(paginatedLeads.map(l => l.id))
    }
  }

  const handleSelect = (id: string) => {
    setSelectedLeads(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleAddLead = () => {
    setEditingLead(null)
    setShowLeadForm(true)
  }

  const handleFormSuccess = () => {
    refetch()
    setSelectedLeads([])
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedLeads.length} lead(s) ?`)) return

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .in('id', selectedLeads)

      if (error) throw error

      refetch()
      setSelectedLeads([])
    } catch (err) {
      console.error('Error deleting leads:', err)
      alert('Erreur lors de la suppression')
    }
  }

  const handleBulkStatusChange = async (newStatus: string) => {
    // Check if the new status is a "lost" status
    if (isLostStatus(newStatus)) {
      setPendingBulkLostStatus(newStatus)
      setShowLostModal(true)
      return
    }

    await performBulkStatusChange(newStatus)
  }

  const performBulkStatusChange = async (newStatus: string, lostReason?: string, lostReasonDetails?: string) => {
    try {
      const updateData: Record<string, unknown> = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      }

      // Add lost-related fields if this is a lost status
      if (lostReason) {
        updateData.lost_reason = lostReason
        updateData.lost_reason_details = lostReasonDetails || null
        updateData.lost_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('leads')
        .update(updateData)
        .in('id', selectedLeads)

      if (error) throw error

      refetch()
      setSelectedLeads([])
    } catch (err) {
      console.error('Error updating leads:', err)
      alert('Erreur lors de la mise à jour')
    }
  }

  const handleBulkLostConfirm = async (reason: string, details?: string) => {
    await performBulkStatusChange(pendingBulkLostStatus, reason, details)
    setShowLostModal(false)
    setPendingBulkLostStatus('')
  }

  const handleBulkAssign = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('leads')
        .update({ assigned_to: userId, updated_at: new Date().toISOString() })
        .in('id', selectedLeads)

      if (error) throw error

      refetch()
      setSelectedLeads([])
    } catch (err) {
      console.error('Error assigning leads:', err)
      alert("Erreur lors de l'assignation")
    }
  }

  const handleExport = () => {
    const selectedData = leads.filter(l => selectedLeads.includes(l.id))
    const csv = [
      ['Nom', 'Email', 'Téléphone', 'Entreprise', 'Statut', 'Priorité'].join(','),
      ...selectedData.map(l => [
        l.full_name || `${l.first_name} ${l.last_name}`,
        l.email,
        l.phone,
        l.company_name,
        l.status,
        l.priority
      ].join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter([])
    setPriorityFilter('')
    setActionFilter('')
    setTagFilter([])
    setAssigneeFilter('')
  }

  const hasFilters = search || statusFilter.length > 0 || priorityFilter || actionFilter || tagFilter.length > 0 || assigneeFilter

  const getPriorityIndicator = (priority: Lead['priority']) => {
    switch (priority) {
      case 'urgent': return '🔴'
      case 'hot': return '🟠'
      case 'warm': return '🟢'
      default: return '⚪'
    }
  }

  const getLeadName = (lead: Lead) => {
    if (lead.full_name) return lead.full_name
    if (lead.first_name || lead.last_name) {
      return `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    }
    return lead.email || 'Sans nom'
  }

  const periodOptions: { key: PeriodFilter; label: string }[] = [
    { key: 'today', label: "Aujourd'hui" },
    { key: 'week', label: '7 jours' },
    { key: 'month', label: 'Ce mois' },
    { key: 'all', label: 'Tout' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {periodOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  period === opt.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setShowImportModal(true)}>
            📥 Importer
          </Button>
          <Button onClick={handleAddLead}>
            + Nouveau lead
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <span className="text-xl">✨</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.new}</div>
              <div className="text-sm text-gray-500">Nouveaux</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <span className="text-xl">📞</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.contacted}</div>
              <div className="text-sm text-gray-500">Contactés</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-yellow-100 flex items-center justify-center">
              <span className="text-xl">⏳</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.inProgress}</div>
              <div className="text-sm text-gray-500">En cours</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <span className="text-xl">🏆</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.closings}</div>
              <div className="text-sm text-gray-500">Closings</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-64">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Rechercher nom, email, entreprise..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Status Multi-select */}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm flex items-center gap-2 hover:border-gray-400"
            >
              Statut {statusFilter.length > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 rounded">{statusFilter.length}</span>}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showStatusDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowStatusDropdown(false)} />
                <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-48 max-h-64 overflow-y-auto">
                  {statuses.map(status => (
                    <label key={status.id} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={statusFilter.includes(status.name)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setStatusFilter([...statusFilter, status.name])
                          } else {
                            setStatusFilter(statusFilter.filter(s => s !== status.name))
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: status.color }} />
                      <span className="text-sm">{status.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Priority */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-gray-400"
          >
            <option value="">Priorité</option>
            <option value="urgent">🔴 Urgent</option>
            <option value="hot">🟠 Hot</option>
            <option value="warm">🟢 Warm</option>
            <option value="cold">⚪ Cold</option>
          </select>

          {/* Action */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-gray-400"
          >
            <option value="">Action</option>
            {LEAD_ACTIONS.map(action => (
              <option key={action.value} value={action.value}>
                {action.icon} {action.label}
              </option>
            ))}
          </select>

          {/* Tags Multi-select */}
          {allTags.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowTagDropdown(!showTagDropdown)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm flex items-center gap-2 hover:border-gray-400"
              >
                Tags {tagFilter.length > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 rounded">{tagFilter.length}</span>}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showTagDropdown && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowTagDropdown(false)} />
                  <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-48 max-h-64 overflow-y-auto">
                    {allTags.map(tag => (
                      <label key={tag} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tagFilter.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTagFilter([...tagFilter, tag])
                            } else {
                              setTagFilter(tagFilter.filter(t => t !== tag))
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm">{tag}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Assignee (for manager/admin) */}
          {(profile?.role === 'admin' || profile?.role === 'manager') && (
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm hover:border-gray-400"
            >
              <option value="">Assigné à</option>
              {teamMembers.map(member => (
                <option key={member.id} value={member.id}>
                  {member.first_name} {member.last_name}
                </option>
              ))}
            </select>
          )}

          {/* Reset */}
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
            >
              Réinitialiser
            </button>
          )}
        </div>

        {/* Active filters display */}
        {hasFilters && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-500">
            <span>{filteredLeads.length} résultat(s)</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Chargement...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900">Aucun lead trouvé</h3>
            <p className="text-gray-500 mt-1">
              {hasFilters ? 'Essayez de modifier vos filtres' : 'Importez des leads ou créez-en un nouveau'}
            </p>
            {!hasFilters && (
              <Button className="mt-4" onClick={handleAddLead}>
                + Créer un lead
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="p-4 text-left w-12">
                      <input
                        type="checkbox"
                        checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                        onChange={handleSelectAll}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Lead / Entreprise</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Secteur</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                    <th className="p-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">Urgence</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Contact</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Assigné</th>
                    <th className="p-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Créé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedLeads.map(lead => (
                    <tr
                      key={lead.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                    >
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedLeads.includes(lead.id)}
                          onChange={() => handleSelect(lead.id)}
                          className="rounded border-gray-300"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{getLeadName(lead)}</span>
                          {sequenceMap[lead.id] && (
                            <span
                              className="text-blue-500"
                              title="Dans une séquence active"
                            >
                              🔄
                            </span>
                          )}
                        </div>
                        {lead.company_name && (
                          <div className="text-sm text-gray-500">{lead.company_name}</div>
                        )}
                      </td>
                      <td className="p-4">
                        {lead.sector && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                            {lead.sector}
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <ActionBadge
                          action={lead.current_action}
                          actionDate={lead.current_action_date}
                          size="sm"
                        />
                      </td>
                      <td className="p-4 text-center text-lg">
                        {getPriorityIndicator(lead.priority)}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-900">{lead.email}</div>
                        {lead.phone && (
                          <div className="text-sm text-gray-500">{lead.phone}</div>
                        )}
                      </td>
                      <td className="p-4">
                        {lead.assignedUser ? (
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={lead.assignedUser.avatar_url}
                              alt={`${lead.assignedUser.first_name} ${lead.assignedUser.last_name}`}
                              size="sm"
                            />
                            <span className="text-sm text-gray-700">{lead.assignedUser.first_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">Non assigné</span>
                        )}
                      </td>
                      <td className="p-4 text-sm text-gray-500">
                        {formatDate(lead.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Page {currentPage} sur {totalPages} • {filteredLeads.length} leads
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Précédent
                  </button>
                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let page: number
                      if (totalPages <= 5) {
                        page = i + 1
                      } else if (currentPage <= 3) {
                        page = i + 1
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i
                      } else {
                        page = currentPage - 2 + i
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1.5 text-sm rounded-lg ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'border border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Suivant
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bulk actions bar */}
      {selectedLeads.length > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white rounded-xl shadow-2xl p-4 flex items-center gap-4 z-50">
          <span className="font-medium">{selectedLeads.length} sélectionné(s)</span>

          <div className="h-6 w-px bg-gray-700" />

          <select
            onChange={(e) => {
              if (e.target.value) handleBulkAssign(e.target.value)
              e.target.value = ''
            }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm cursor-pointer hover:border-gray-600"
          >
            <option value="">👤 Assigner à...</option>
            {teamMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.first_name} {member.last_name}
              </option>
            ))}
          </select>

          <select
            onChange={(e) => {
              if (e.target.value) handleBulkStatusChange(e.target.value)
              e.target.value = ''
            }}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm cursor-pointer hover:border-gray-600"
          >
            <option value="">🏷️ Changer statut...</option>
            {statuses.map(status => (
              <option key={status.id} value={status.name}>{status.name}</option>
            ))}
          </select>

          <button
            onClick={handleExport}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-sm hover:border-gray-600 flex items-center gap-2"
          >
            📤 Exporter
          </button>

          {(profile?.role === 'admin' || profile?.role === 'manager') && (
            <button
              onClick={handleBulkDelete}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-sm"
            >
              🗑️ Supprimer
            </button>
          )}

          <button
            onClick={() => setSelectedLeads([])}
            className="p-1.5 hover:bg-gray-700 rounded-lg ml-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Lead Form Modal */}
      <LeadForm
        isOpen={showLeadForm}
        onClose={() => {
          setShowLeadForm(false)
          setEditingLead(null)
        }}
        onSuccess={handleFormSuccess}
        lead={editingLead}
        statuses={statuses}
        teamMembers={teamMembers}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={() => {
          refetch()
          setShowImportModal(false)
        }}
        statuses={statuses}
        teamMembers={teamMembers}
      />

      {/* Lost Reason Modal for bulk status change */}
      <LostReasonModal
        isOpen={showLostModal}
        onClose={() => {
          setShowLostModal(false)
          setPendingBulkLostStatus('')
        }}
        onConfirm={handleBulkLostConfirm}
        leadName={selectedLeads.length > 1 ? `${selectedLeads.length} leads sélectionnés` : undefined}
      />
    </div>
  )
}
