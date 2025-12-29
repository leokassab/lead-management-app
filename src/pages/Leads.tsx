import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Layout } from '../components/layout'
import { Button, Badge, Avatar } from '../components/ui'
import LeadForm from '../components/leads/LeadForm'
import ImportModal from '../components/leads/ImportModal'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useLeads } from '../hooks/useLeads'
import { getPriorityLabel } from '../utils/helpers'
import { formatDate } from '../utils/formatters'
import type { Lead, User } from '../types'

export default function Leads() {
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { leads, statuses, loading, refetch } = useLeads()

  // Team members for assignment
  const [teamMembers, setTeamMembers] = useState<User[]>([])

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')

  // Selection
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])

  // Modals
  const [showLeadForm, setShowLeadForm] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)

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

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
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

      // Status filter
      if (statusFilter && lead.status !== statusFilter) return false

      // Priority filter
      if (priorityFilter && lead.priority !== priorityFilter) return false

      // Assignee filter
      if (assigneeFilter && lead.assigned_to !== assigneeFilter) return false

      return true
    })
  }, [leads, search, statusFilter, priorityFilter, assigneeFilter])

  // Stats
  const stats = useMemo(() => {
    const newStatus = statuses.find(s => s.name === 'Opt-in')
    const contactedStatus = statuses.find(s => s.name === 'Contacté')
    const wonStatus = statuses.find(s => s.name === 'Gagné')

    return {
      new: leads.filter(l => l.status === newStatus?.name || l.status === 'new').length,
      contacted: leads.filter(l => l.status === contactedStatus?.name).length,
      inProgress: leads.filter(l =>
        l.status !== newStatus?.name &&
        l.status !== wonStatus?.name &&
        l.status !== 'Perdu' &&
        l.status !== 'new'
      ).length,
      closings: leads.filter(l => l.status === wonStatus?.name).length,
    }
  }, [leads, statuses])

  // Handlers
  const handleSelectAll = () => {
    if (selectedLeads.length === filteredLeads.length) {
      setSelectedLeads([])
    } else {
      setSelectedLeads(filteredLeads.map(l => l.id))
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
    try {
      const { error } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', selectedLeads)

      if (error) throw error

      refetch()
      setSelectedLeads([])
    } catch (err) {
      console.error('Error updating leads:', err)
      alert('Erreur lors de la mise à jour')
    }
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
      alert('Erreur lors de l\'assignation')
    }
  }

  const clearFilters = () => {
    setSearch('')
    setStatusFilter('')
    setPriorityFilter('')
    setAssigneeFilter('')
  }

  const getStatusColor = (statusName: string) => {
    const status = statuses.find(s => s.name === statusName)
    return status?.color || '#9CA3AF'
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>
              📥 Importer
            </Button>
            <Button onClick={handleAddLead}>
              ➕ Nouveau lead
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Nouveaux</div>
            <div className="text-2xl font-bold text-blue-600">{stats.new}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Contactés</div>
            <div className="text-2xl font-bold text-orange-600">{stats.contacted}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">En cours</div>
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Closings</div>
            <div className="text-2xl font-bold text-green-600">{stats.closings}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Rechercher nom, email, entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-64 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          >
            <option value="">Tous les statuts</option>
            {statuses.map(status => (
              <option key={status.id} value={status.name}>{status.name}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          >
            <option value="">Toutes priorités</option>
            <option value="urgent">🔴 Urgent</option>
            <option value="hot">🟠 Hot</option>
            <option value="warm">🟢 Warm</option>
            <option value="cold">⚪ Cold</option>
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm"
          >
            <option value="">Tous les assignés</option>
            {teamMembers.map(member => (
              <option key={member.id} value={member.id}>
                {member.first_name} {member.last_name}
              </option>
            ))}
          </select>
          {(search || statusFilter || priorityFilter || assigneeFilter) && (
            <Button variant="ghost" onClick={clearFilters}>
              Réinitialiser
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Chargement...</div>
          ) : filteredLeads.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <div className="text-4xl mb-2">📋</div>
              <p>Aucun lead pour le moment</p>
              <p className="text-sm mt-1">Importez des leads ou créez-en un nouveau</p>
              <Button className="mt-4" onClick={handleAddLead}>
                ➕ Créer un lead
              </Button>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedLeads.length === filteredLeads.length && filteredLeads.length > 0}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Lead / Entreprise</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Secteur</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Statut</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Priorité</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Contact</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Assigné</th>
                  <th className="p-4 text-left text-sm font-medium text-gray-600">Créé</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeads.map(lead => (
                  <tr
                    key={lead.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
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
                      <div className="font-medium text-gray-900">
                        {lead.full_name || `${lead.first_name} ${lead.last_name}`}
                      </div>
                      <div className="text-sm text-gray-500">{lead.company_name}</div>
                    </td>
                    <td className="p-4">
                      {lead.sector && (
                        <Badge variant="outline">{lead.sector}</Badge>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge color={getStatusColor(lead.status)}>
                        {lead.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="text-sm">{getPriorityLabel(lead.priority)}</span>
                    </td>
                    <td className="p-4">
                      <div className="text-sm">{lead.email}</div>
                      <div className="text-sm text-gray-500">{lead.phone}</div>
                    </td>
                    <td className="p-4">
                      {lead.assignedUser && (
                        <div className="flex items-center gap-2">
                          <Avatar
                            src={lead.assignedUser.avatar_url}
                            alt={`${lead.assignedUser.first_name} ${lead.assignedUser.last_name}`}
                            size="sm"
                          />
                          <span className="text-sm">{lead.assignedUser.first_name}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Bulk actions bar */}
        {selectedLeads.length > 0 && (
          <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white rounded-lg shadow-xl p-4 flex items-center gap-4 z-50">
            <span className="font-medium">{selectedLeads.length} sélectionné(s)</span>

            <select
              onChange={(e) => {
                if (e.target.value) handleBulkAssign(e.target.value)
                e.target.value = ''
              }}
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
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
              className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded text-sm"
            >
              <option value="">🔄 Changer statut...</option>
              {statuses.map(status => (
                <option key={status.id} value={status.name}>{status.name}</option>
              ))}
            </select>

            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleBulkDelete}
              >
                🗑️ Supprimer
              </Button>
            )}

            <button
              onClick={() => setSelectedLeads([])}
              className="p-1 hover:bg-gray-700 rounded"
            >
              ✕
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
      </div>
    </Layout>
  )
}
