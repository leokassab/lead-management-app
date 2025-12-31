import { useState, useMemo, useEffect } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventClickArg, DateSelectArg } from '@fullcalendar/core'
import { Button, Modal, Input, Select } from '../components/ui'
import { useMeetings } from '../hooks/useMeetings'
import { useAuthStore } from '../stores/authStore'
import { supabase } from '../lib/supabase'
import { formatDateTime } from '../utils/formatters'
import {
  MEETING_TYPE_LABELS,
  MEETING_STATUS_LABELS,
  DURATION_OPTIONS,
  type Meeting,
  type MeetingFormData,
  type MeetingType,
} from '../types/meetings'
type LeadOption = {
  id: string
  full_name?: string
  first_name?: string
  last_name?: string
  email?: string
  company_name?: string
}

export default function Calendar() {
  const { profile } = useAuthStore()
  const {
    meetings,
    upcomingMeetings,
    loading,
    createMeeting,
    completeMeeting,
    cancelMeeting,
  } = useMeetings()

  // Leads for selection
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [leadSearch, setLeadSearch] = useState('')

  // Modals
  const [showNewMeetingModal, setShowNewMeetingModal] = useState(false)
  const [showMeetingDetailModal, setShowMeetingDetailModal] = useState(false)
  const [showCompleteModal, setShowCompleteModal] = useState(false)
  const [showNoShowFollowUpModal, setShowNoShowFollowUpModal] = useState(false)
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null)

  // Complete meeting form
  const [completeOutcome, setCompleteOutcome] = useState('')
  const [completeNotes, setCompleteNotes] = useState('')
  const [completeNextSteps, setCompleteNextSteps] = useState('')

  // New meeting form
  const [newMeeting, setNewMeeting] = useState<Partial<MeetingFormData>>({
    duration_minutes: 30,
    type: 'call',
    reminder_email_lead: true,
    reminder_sms_lead: false,
  })
  const [creating, setCreating] = useState(false)

  // Calendar view
  const [currentView, setCurrentView] = useState<'dayGridMonth' | 'timeGridWeek' | 'timeGridDay'>('timeGridWeek')

  // Fetch leads for dropdown
  useEffect(() => {
    if (profile?.team_id) {
      supabase
        .from('leads')
        .select('id, full_name, first_name, last_name, email, company_name')
        .eq('team_id', profile.team_id)
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data }) => {
          if (data) setLeads(data)
        })
    }
  }, [profile?.team_id])

  // Filter leads by search
  const filteredLeads = useMemo(() => {
    if (!leadSearch) return leads.slice(0, 20)
    const search = leadSearch.toLowerCase()
    return leads.filter(lead => {
      const name = lead.full_name || `${lead.first_name} ${lead.last_name}`
      return (
        name.toLowerCase().includes(search) ||
        lead.email?.toLowerCase().includes(search) ||
        lead.company_name?.toLowerCase().includes(search)
      )
    }).slice(0, 20)
  }, [leads, leadSearch])

  // Convert meetings to FullCalendar events
  const calendarEvents = useMemo(() => {
    return meetings.map(meeting => {
      let backgroundColor = '#3B82F6' // default blue

      switch (meeting.status) {
        case 'scheduled':
          backgroundColor = '#3B82F6' // blue
          break
        case 'confirmed':
          backgroundColor = '#10B981' // green
          break
        case 'completed':
          backgroundColor = '#6B7280' // gray
          break
        case 'no_show':
          backgroundColor = '#EF4444' // red
          break
        case 'cancelled':
        case 'rescheduled':
          backgroundColor = '#9CA3AF' // light gray
          break
      }

      const leadName = meeting.lead?.full_name ||
        `${meeting.lead?.first_name || ''} ${meeting.lead?.last_name || ''}`.trim() ||
        'Lead'

      return {
        id: meeting.id,
        title: `${MEETING_TYPE_LABELS[meeting.type].icon} ${meeting.title} - ${leadName}`,
        start: meeting.scheduled_at,
        end: new Date(new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60 * 1000).toISOString(),
        backgroundColor,
        borderColor: backgroundColor,
        extendedProps: { meeting },
      }
    })
  }, [meetings])

  // Stats for the current month
  const monthStats = useMemo(() => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)

    const monthMeetings = meetings.filter(m => {
      const date = new Date(m.scheduled_at)
      return date >= startOfMonth && date <= endOfMonth
    })

    const scheduled = monthMeetings.filter(m => m.status === 'scheduled' || m.status === 'confirmed').length
    const completed = monthMeetings.filter(m => m.status === 'completed').length
    const noShow = monthMeetings.filter(m => m.status === 'no_show').length
    const total = completed + noShow

    return {
      scheduled,
      completed,
      noShow,
      presenceRate: total > 0 ? Math.round((completed / total) * 100) : 100,
    }
  }, [meetings])

  // Handle date selection (click on empty slot)
  const handleDateSelect = (selectInfo: DateSelectArg) => {
    setNewMeeting({
      ...newMeeting,
      scheduled_at: selectInfo.startStr.slice(0, 16),
      user_id: profile?.id,
    })
    setShowNewMeetingModal(true)
  }

  // Handle event click
  const handleEventClick = (clickInfo: EventClickArg) => {
    const meeting = clickInfo.event.extendedProps.meeting as Meeting
    setSelectedMeeting(meeting)
    setShowMeetingDetailModal(true)
  }

  // Handle create meeting
  const handleCreateMeeting = async () => {
    if (!newMeeting.lead_id || !newMeeting.scheduled_at || !newMeeting.title) {
      alert('Veuillez remplir tous les champs obligatoires')
      return
    }

    setCreating(true)
    const result = await createMeeting({
      lead_id: newMeeting.lead_id,
      user_id: newMeeting.user_id || profile?.id || '',
      title: newMeeting.title,
      description: newMeeting.description,
      scheduled_at: new Date(newMeeting.scheduled_at).toISOString(),
      duration_minutes: newMeeting.duration_minutes || 30,
      type: newMeeting.type || 'call',
      location: newMeeting.location,
      reminder_email_lead: newMeeting.reminder_email_lead,
      reminder_sms_lead: newMeeting.reminder_sms_lead,
    })

    if (result) {
      setShowNewMeetingModal(false)
      setNewMeeting({
        duration_minutes: 30,
        type: 'call',
        reminder_email_lead: true,
        reminder_sms_lead: false,
      })
      setLeadSearch('')
    }
    setCreating(false)
  }

  // Open complete modal
  const handleOpenCompleteModal = () => {
    setCompleteOutcome('')
    setCompleteNotes('')
    setCompleteNextSteps('')
    setShowMeetingDetailModal(false)
    setShowCompleteModal(true)
  }

  // Handle complete meeting with notes
  const handleCompleteMeetingWithNotes = async () => {
    if (!selectedMeeting) return

    await completeMeeting(selectedMeeting.id, {
      status: 'completed',
      outcome: completeOutcome,
      notes: completeNotes,
      next_steps: completeNextSteps,
    })

    setShowCompleteModal(false)
    setSelectedMeeting(null)
    setCompleteOutcome('')
    setCompleteNotes('')
    setCompleteNextSteps('')
  }

  // Handle no-show
  const handleNoShow = async () => {
    if (!selectedMeeting) return

    await completeMeeting(selectedMeeting.id, { status: 'no_show' })
    setShowMeetingDetailModal(false)
    setShowNoShowFollowUpModal(true)
  }

  // Handle reschedule from no-show
  const handleRescheduleFromNoShow = () => {
    if (!selectedMeeting) return

    // Pre-fill new meeting with same data
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(10, 0, 0, 0)

    setNewMeeting({
      lead_id: selectedMeeting.lead_id,
      user_id: selectedMeeting.user_id,
      title: selectedMeeting.title,
      description: selectedMeeting.description,
      scheduled_at: tomorrow.toISOString().slice(0, 16),
      duration_minutes: selectedMeeting.duration_minutes,
      type: selectedMeeting.type,
      location: selectedMeeting.location,
      reminder_email_lead: true,
      reminder_sms_lead: false,
    })

    // Find lead name for search field
    const leadName = getLeadName(selectedMeeting.lead)
    setLeadSearch(leadName)

    setShowNoShowFollowUpModal(false)
    setShowNewMeetingModal(true)
  }

  // Handle send follow-up email
  const handleSendFollowUpEmail = () => {
    if (!selectedMeeting?.lead?.email) {
      alert('Aucun email disponible pour ce lead')
      return
    }

    const leadName = getLeadName(selectedMeeting.lead)
    const subject = encodeURIComponent(`Suite à notre RDV manqué - ${selectedMeeting.title}`)
    const body = encodeURIComponent(
      `Bonjour ${selectedMeeting.lead.first_name || leadName},\n\n` +
      `Je me permets de vous recontacter suite à notre rendez-vous prévu qui n'a pas pu avoir lieu.\n\n` +
      `Seriez-vous disponible pour que nous reprogrammions un créneau ?\n\n` +
      `Cordialement`
    )

    window.open(`mailto:${selectedMeeting.lead.email}?subject=${subject}&body=${body}`, '_blank')
    setShowNoShowFollowUpModal(false)
    setSelectedMeeting(null)
  }

  // Handle cancel meeting
  const handleCancelMeeting = async () => {
    if (!selectedMeeting) return
    if (!confirm('Êtes-vous sûr de vouloir annuler ce RDV ?')) return

    await cancelMeeting(selectedMeeting.id)
    setShowMeetingDetailModal(false)
    setSelectedMeeting(null)
  }

  const getLeadName = (lead?: LeadOption | Meeting['lead']) => {
    if (!lead) return 'Lead inconnu'
    return lead.full_name || `${lead.first_name || ''} ${lead.last_name || ''}`.trim() || lead.email || 'Lead'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Calendrier</h1>
          <p className="text-gray-600 mt-1">Gérez vos rendez-vous</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled>
            🔗 Connecter calendrier
          </Button>
          <Button onClick={() => {
            setNewMeeting({
              duration_minutes: 30,
              type: 'call',
              reminder_email_lead: true,
              reminder_sms_lead: false,
              user_id: profile?.id,
            })
            setShowNewMeetingModal(true)
          }}>
            + Nouveau RDV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar - 3/4 */}
        <div className="lg:col-span-3 bg-white rounded-lg shadow p-4">
          {/* View Toggle */}
          <div className="flex items-center justify-end gap-2 mb-4">
            <button
              onClick={() => setCurrentView('timeGridDay')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentView === 'timeGridDay'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Jour
            </button>
            <button
              onClick={() => setCurrentView('timeGridWeek')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentView === 'timeGridWeek'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semaine
            </button>
            <button
              onClick={() => setCurrentView('dayGridMonth')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                currentView === 'dayGridMonth'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mois
            </button>
          </div>

          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView={currentView}
            key={currentView}
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            locale="fr"
            firstDay={1}
            slotMinTime="07:00:00"
            slotMaxTime="20:00:00"
            allDaySlot={false}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={true}
            weekends={true}
            events={calendarEvents}
            select={handleDateSelect}
            eventClick={handleEventClick}
            height="auto"
            buttonText={{
              today: "Aujourd'hui",
              month: 'Mois',
              week: 'Semaine',
              day: 'Jour',
            }}
          />
        </div>

        {/* Sidebar - 1/4 */}
        <div className="space-y-6">
          {/* Stats */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Stats du mois</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Planifiés</span>
                <span className="font-semibold text-blue-600">{monthStats.scheduled}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Effectués</span>
                <span className="font-semibold text-green-600">{monthStats.completed}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">No-show</span>
                <span className="font-semibold text-red-600">{monthStats.noShow}</span>
              </div>
              <hr />
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Taux présence</span>
                <span className={`font-semibold ${
                  monthStats.presenceRate >= 80 ? 'text-green-600' :
                  monthStats.presenceRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                }`}>
                  {monthStats.presenceRate}%
                </span>
              </div>
            </div>
          </div>

          {/* Upcoming meetings */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">📅 Prochains RDV</h2>
            {upcomingMeetings.length === 0 ? (
              <p className="text-gray-500 text-sm">Aucun RDV à venir</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.slice(0, 5).map(meeting => (
                  <div
                    key={meeting.id}
                    className="p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                    onClick={() => {
                      setSelectedMeeting(meeting)
                      setShowMeetingDetailModal(true)
                    }}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span>{MEETING_TYPE_LABELS[meeting.type].icon}</span>
                      <span className="font-medium text-gray-900 text-sm truncate">
                        {meeting.title}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {getLeadName(meeting.lead)}
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      {formatDateTime(meeting.scheduled_at)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Meeting Modal */}
      <Modal
        isOpen={showNewMeetingModal}
        onClose={() => setShowNewMeetingModal(false)}
        title="📅 Nouveau RDV"
        size="lg"
      >
        <div className="space-y-4">
          {/* Lead selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Lead *
            </label>
            <input
              type="text"
              placeholder="Rechercher un lead..."
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg mb-2"
            />
            {leadSearch && (
              <div className="max-h-40 overflow-y-auto border rounded-lg">
                {filteredLeads.map(lead => (
                  <button
                    key={lead.id}
                    onClick={() => {
                      setNewMeeting({ ...newMeeting, lead_id: lead.id })
                      setLeadSearch(getLeadName(lead))
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 text-sm ${
                      newMeeting.lead_id === lead.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="font-medium">{getLeadName(lead)}</div>
                    {lead.company_name && (
                      <div className="text-xs text-gray-500">{lead.company_name}</div>
                    )}
                  </button>
                ))}
                {filteredLeads.length === 0 && (
                  <div className="px-3 py-2 text-sm text-gray-500">Aucun lead trouvé</div>
                )}
              </div>
            )}
            {newMeeting.lead_id && !leadSearch && (
              <div className="px-3 py-2 bg-blue-50 rounded-lg text-sm">
                Lead sélectionné: {getLeadName(leads.find(l => l.id === newMeeting.lead_id))}
              </div>
            )}
          </div>

          {/* Title */}
          <Input
            label="Titre *"
            value={newMeeting.title || ''}
            onChange={(e) => setNewMeeting({ ...newMeeting, title: e.target.value })}
            placeholder="Ex: Démo produit"
          />

          {/* Date/Time */}
          <Input
            label="Date et heure *"
            type="datetime-local"
            value={newMeeting.scheduled_at || ''}
            onChange={(e) => setNewMeeting({ ...newMeeting, scheduled_at: e.target.value })}
          />

          {/* Duration & Type */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Durée"
              value={String(newMeeting.duration_minutes || 30)}
              onChange={(e) => setNewMeeting({ ...newMeeting, duration_minutes: parseInt(e.target.value) })}
              options={DURATION_OPTIONS.map(d => ({ value: String(d.value), label: d.label }))}
            />
            <Select
              label="Type"
              value={newMeeting.type || 'call'}
              onChange={(e) => setNewMeeting({ ...newMeeting, type: e.target.value as MeetingType })}
              options={Object.entries(MEETING_TYPE_LABELS).map(([value, config]) => ({
                value,
                label: `${config.icon} ${config.label}`,
              }))}
            />
          </div>

          {/* Location */}
          <Input
            label="Lieu / Lien visio"
            value={newMeeting.location || ''}
            onChange={(e) => setNewMeeting({ ...newMeeting, location: e.target.value })}
            placeholder="Ex: https://meet.google.com/..."
          />

          {/* Reminders */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rappels
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newMeeting.reminder_email_lead || false}
                  onChange={(e) => setNewMeeting({ ...newMeeting, reminder_email_lead: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Envoyer rappel email au lead</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newMeeting.reminder_sms_lead || false}
                  onChange={(e) => setNewMeeting({ ...newMeeting, reminder_sms_lead: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Envoyer rappel SMS au lead</span>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowNewMeetingModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreateMeeting} disabled={creating}>
              {creating ? 'Création...' : 'Créer'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Meeting Detail Modal */}
      <Modal
        isOpen={showMeetingDetailModal}
        onClose={() => {
          setShowMeetingDetailModal(false)
          setSelectedMeeting(null)
        }}
        title={selectedMeeting ? `${MEETING_TYPE_LABELS[selectedMeeting.type].icon} ${selectedMeeting.title}` : 'Détail RDV'}
        size="md"
      >
        {selectedMeeting && (
          <div className="space-y-4">
            {/* Status badge */}
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${MEETING_STATUS_LABELS[selectedMeeting.status].color}`}>
                {MEETING_STATUS_LABELS[selectedMeeting.status].icon} {MEETING_STATUS_LABELS[selectedMeeting.status].label}
              </span>
            </div>

            {/* Lead info */}
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Lead</div>
              <div className="font-medium text-gray-900">{getLeadName(selectedMeeting.lead)}</div>
              {selectedMeeting.lead?.company_name && (
                <div className="text-sm text-gray-600">{selectedMeeting.lead.company_name}</div>
              )}
              {selectedMeeting.lead?.email && (
                <div className="text-sm text-blue-600">{selectedMeeting.lead.email}</div>
              )}
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500">Date & Heure</div>
                <div className="font-medium">{formatDateTime(selectedMeeting.scheduled_at)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Durée</div>
                <div className="font-medium">{selectedMeeting.duration_minutes} min</div>
              </div>
            </div>

            {/* Location */}
            {selectedMeeting.location && (
              <div>
                <div className="text-sm text-gray-500">Lieu / Lien</div>
                {selectedMeeting.location.startsWith('http') ? (
                  <a
                    href={selectedMeeting.location}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {selectedMeeting.location}
                  </a>
                ) : (
                  <div className="font-medium">{selectedMeeting.location}</div>
                )}
              </div>
            )}

            {/* Notes */}
            {selectedMeeting.notes && (
              <div>
                <div className="text-sm text-gray-500">Notes</div>
                <div className="text-gray-700">{selectedMeeting.notes}</div>
              </div>
            )}

            {/* Outcome (if completed) */}
            {selectedMeeting.outcome && (
              <div>
                <div className="text-sm text-gray-500">Résultat</div>
                <div className="text-gray-700">{selectedMeeting.outcome}</div>
              </div>
            )}

            {/* Actions */}
            {(selectedMeeting.status === 'scheduled' || selectedMeeting.status === 'confirmed') && (
              <>
                {/* Past meeting - show complete/no-show buttons prominently */}
                {new Date(selectedMeeting.scheduled_at) < new Date() && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                    <p className="text-yellow-800 text-sm font-medium mb-3">
                      ⚠️ Ce RDV est passé. Quel a été le résultat ?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-green-600 hover:bg-green-700"
                        onClick={handleOpenCompleteModal}
                      >
                        ✅ Terminé
                      </Button>
                      <Button
                        className="flex-1 bg-red-600 hover:bg-red-700"
                        onClick={handleNoShow}
                      >
                        ❌ No-show
                      </Button>
                    </div>
                  </div>
                )}

                {/* Future meeting - show all options */}
                {new Date(selectedMeeting.scheduled_at) >= new Date() && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button
                      variant="outline"
                      className="flex-1 text-green-600"
                      onClick={handleOpenCompleteModal}
                    >
                      ✅ Terminé
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-red-600"
                      onClick={handleNoShow}
                    >
                      ❌ No-show
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 text-gray-600"
                      onClick={handleCancelMeeting}
                    >
                      🚫 Annuler
                    </Button>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowMeetingDetailModal(false)
                  setSelectedMeeting(null)
                }}
              >
                Fermer
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Complete Meeting Modal */}
      <Modal
        isOpen={showCompleteModal}
        onClose={() => {
          setShowCompleteModal(false)
          setSelectedMeeting(null)
        }}
        title="✅ Terminer le RDV"
        size="md"
      >
        {selectedMeeting && (
          <div className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="font-medium">{selectedMeeting.title}</div>
              <div className="text-sm text-gray-600">{getLeadName(selectedMeeting.lead)}</div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Résultat du RDV
              </label>
              <select
                value={completeOutcome}
                onChange={(e) => setCompleteOutcome(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Sélectionner...</option>
                <option value="Intéressé - à relancer">Intéressé - à relancer</option>
                <option value="Devis envoyé">Devis envoyé</option>
                <option value="Négociation en cours">Négociation en cours</option>
                <option value="Signé / Gagné">Signé / Gagné</option>
                <option value="Pas intéressé">Pas intéressé</option>
                <option value="À recontacter plus tard">À recontacter plus tard</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
              </label>
              <textarea
                value={completeNotes}
                onChange={(e) => setCompleteNotes(e.target.value)}
                placeholder="Notes sur le RDV..."
                className="w-full px-3 py-2 border rounded-lg resize-none"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prochaines étapes
              </label>
              <textarea
                value={completeNextSteps}
                onChange={(e) => setCompleteNextSteps(e.target.value)}
                placeholder="Actions à faire suite au RDV..."
                className="w-full px-3 py-2 border rounded-lg resize-none"
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => {
                  setShowCompleteModal(false)
                  setSelectedMeeting(null)
                }}
              >
                Annuler
              </Button>
              <Button onClick={handleCompleteMeetingWithNotes}>
                Valider
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* No-Show Follow-up Modal */}
      <Modal
        isOpen={showNoShowFollowUpModal}
        onClose={() => {
          setShowNoShowFollowUpModal(false)
          setSelectedMeeting(null)
        }}
        title="❌ RDV manqué - Que faire ?"
        size="md"
      >
        {selectedMeeting && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="font-medium text-red-800">
                {selectedMeeting.title}
              </div>
              <div className="text-sm text-red-600">
                {getLeadName(selectedMeeting.lead)} n'est pas venu au RDV
              </div>
            </div>

            <p className="text-gray-600">
              Que souhaitez-vous faire ?
            </p>

            <div className="space-y-3">
              <button
                onClick={handleRescheduleFromNoShow}
                className="w-full p-4 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📅</span>
                  <div>
                    <div className="font-medium text-gray-900">Replanifier le RDV</div>
                    <div className="text-sm text-gray-500">Proposer un nouveau créneau</div>
                  </div>
                </div>
              </button>

              <button
                onClick={handleSendFollowUpEmail}
                className="w-full p-4 text-left border rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📧</span>
                  <div>
                    <div className="font-medium text-gray-900">Envoyer un email de relance</div>
                    <div className="text-sm text-gray-500">Ouvre votre client email</div>
                  </div>
                </div>
              </button>

              <button
                onClick={() => {
                  setShowNoShowFollowUpModal(false)
                  setSelectedMeeting(null)
                }}
                className="w-full p-4 text-left border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">❌</span>
                  <div>
                    <div className="font-medium text-gray-900">Ne rien faire</div>
                    <div className="text-sm text-gray-500">Fermer cette fenêtre</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
