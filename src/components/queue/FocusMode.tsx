import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ActionBadge } from '../actions'
import type { Lead, LeadAction } from '../../types'
import { getActionConfig } from '../../types'

interface FocusModeProps {
  leads: Lead[]
  onClose: () => void
  onUpdateAction: (leadId: string, action: LeadAction, date?: string, note?: string) => Promise<void>
}

export default function FocusMode({ leads, onClose, onUpdateAction }: FocusModeProps) {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showPostpone, setShowPostpone] = useState(false)
  const [postponeDate, setPostponeDate] = useState('')
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const currentLead = leads[currentIndex]
  const totalLeads = leads.length

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (showPostpone) return // Don't handle shortcuts when modal is open

      switch (e.key) {
        case 'ArrowRight':
          goNext()
          break
        case 'ArrowLeft':
          goPrev()
          break
        case 'Enter':
          if (currentLead?.phone) handleCall()
          break
        case 'Escape':
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, showPostpone, currentLead])

  const goNext = useCallback(() => {
    if (currentIndex < totalLeads - 1) {
      setCurrentIndex(prev => prev + 1)
    }
  }, [currentIndex, totalLeads])

  const goPrev = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
    }
  }, [currentIndex])

  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedField(field)
    setTimeout(() => setCopiedField(null), 2000)
  }

  const getLeadName = (lead: Lead) => {
    if (lead.full_name) return lead.full_name
    if (lead.first_name || lead.last_name) {
      return `${lead.first_name || ''} ${lead.last_name || ''}`.trim()
    }
    return lead.email || 'Sans nom'
  }

  const getPriorityBadge = (priority: Lead['priority']) => {
    const config = {
      urgent: { label: 'Urgent', bg: 'bg-red-100', text: 'text-red-700' },
      hot: { label: 'Chaud', bg: 'bg-orange-100', text: 'text-orange-700' },
      warm: { label: 'Tiède', bg: 'bg-yellow-100', text: 'text-yellow-700' },
      cold: { label: 'Froid', bg: 'bg-gray-100', text: 'text-gray-700' },
    }
    return config[priority] || config.cold
  }

  const handleCall = () => {
    if (currentLead?.phone) {
      window.open(`tel:${currentLead.phone}`, '_self')
    }
  }

  const handleEmail = () => {
    if (currentLead?.email) {
      window.open(`mailto:${currentLead.email}`, '_blank')
    }
  }

  const handleWhatsApp = () => {
    if (currentLead?.phone) {
      const phone = currentLead.phone.replace(/\D/g, '')
      window.open(`https://wa.me/${phone}`, '_blank')
    }
  }

  const handleSMS = () => {
    if (currentLead?.phone) {
      window.open(`sms:${currentLead.phone}`, '_self')
    }
  }

  const handlePostpone = async () => {
    if (!postponeDate || !currentLead) return
    await onUpdateAction(currentLead.id, currentLead.current_action || 'follow_up', postponeDate)
    setShowPostpone(false)
    setPostponeDate('')
    goNext()
  }

  const handleSkip = async () => {
    if (!currentLead) return
    await onUpdateAction(currentLead.id, 'waiting_response')
    goNext()
  }

  const handleScheduleMeeting = async () => {
    if (!currentLead) return
    await onUpdateAction(currentLead.id, 'meeting_scheduled', new Date().toISOString())
    goNext()
  }

  if (!currentLead) {
    return (
      <div className="fixed inset-0 bg-gray-900/95 z-50 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold mb-2">Queue terminée !</h2>
          <p className="text-gray-400 mb-6">Tous les leads ont été traités</p>
          <button
            onClick={onClose}
            className="px-6 py-3 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100"
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  const priorityBadge = getPriorityBadge(currentLead.priority)
  const actionConfig = getActionConfig(currentLead.current_action)

  return (
    <div className="fixed inset-0 bg-gray-900/95 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <span className="text-white font-medium">Mode Focus</span>
        </div>

        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-lg font-semibold text-white">{currentIndex + 1}</span>
          <span>/</span>
          <span>{totalLeads}</span>
        </div>

        <div className="text-xs text-gray-500">
          ← → naviguer • Entrée = appeler • Échap = fermer
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto flex items-center justify-center p-6">
        <div className="w-full max-w-xl">
          {/* Lead Card */}
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
            {/* Header with name and badges */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {getLeadName(currentLead)}
                  </h2>
                  {currentLead.company_name && (
                    <p className="text-lg text-gray-600">{currentLead.company_name}</p>
                  )}
                  {currentLead.job_title && (
                    <p className="text-gray-500">{currentLead.job_title}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2">
                  {currentLead.ai_score !== undefined && currentLead.ai_score !== null && (
                    <div className={`
                      px-3 py-1 rounded-full text-sm font-bold
                      ${currentLead.ai_score >= 80 ? 'bg-green-100 text-green-700' : ''}
                      ${currentLead.ai_score >= 50 && currentLead.ai_score < 80 ? 'bg-yellow-100 text-yellow-700' : ''}
                      ${currentLead.ai_score < 50 ? 'bg-gray-100 text-gray-600' : ''}
                    `}>
                      IA {currentLead.ai_score}%
                    </div>
                  )}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityBadge.bg} ${priorityBadge.text}`}>
                    {priorityBadge.label}
                  </span>
                </div>
              </div>
            </div>

            {/* Action recommandée */}
            <div className="px-6 py-4 bg-blue-50 border-b border-blue-100">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{actionConfig.icon}</span>
                <div>
                  <div className="text-sm text-blue-600 font-medium">Action recommandée</div>
                  <div className="text-lg font-semibold text-blue-900">{actionConfig.label}</div>
                </div>
                {currentLead.current_action_date && (
                  <ActionBadge
                    action={currentLead.current_action}
                    actionDate={currentLead.current_action_date}
                    showDate
                    size="sm"
                  />
                )}
              </div>
              {currentLead.current_action_note && (
                <p className="mt-2 text-sm text-blue-700 bg-blue-100 rounded p-2">
                  📝 {currentLead.current_action_note}
                </p>
              )}
            </div>

            {/* Infos clés */}
            <div className="p-6 space-y-3">
              {currentLead.email && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">📧</span>
                    <span className="text-gray-900">{currentLead.email}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(currentLead.email!, 'email')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {copiedField === 'email' ? '✓ Copié' : 'Copier'}
                  </button>
                </div>
              )}

              {currentLead.phone && (
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400">📞</span>
                    <span className="text-gray-900">{currentLead.phone}</span>
                  </div>
                  <button
                    onClick={() => copyToClipboard(currentLead.phone!, 'phone')}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {copiedField === 'phone' ? '✓ Copié' : 'Copier'}
                  </button>
                </div>
              )}

              <div className="flex gap-3 flex-wrap">
                {currentLead.source && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                    Source: {currentLead.source}
                  </span>
                )}
                {currentLead.sector && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                    {currentLead.sector}
                  </span>
                )}
                {currentLead.city && (
                  <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                    📍 {currentLead.city}
                  </span>
                )}
              </div>

              {/* Conseil IA */}
              {currentLead.ai_recommendations && (
                <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                    <span>🤖</span>
                    <span>Conseil IA</span>
                  </div>
                  <p className="text-gray-600 text-sm">{currentLead.ai_recommendations}</p>
                </div>
              )}
            </div>

            {/* Gros boutons d'action */}
            <div className="p-6 border-t border-gray-100">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <button
                  onClick={handleCall}
                  disabled={!currentLead.phone}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                    ${currentLead.phone
                      ? 'bg-green-500 hover:bg-green-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <span className="text-2xl">📞</span>
                  <span className="text-sm font-medium">Appeler</span>
                </button>

                <button
                  onClick={handleEmail}
                  disabled={!currentLead.email}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                    ${currentLead.email
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <span className="text-2xl">📧</span>
                  <span className="text-sm font-medium">Email</span>
                </button>

                <button
                  onClick={handleWhatsApp}
                  disabled={!currentLead.phone}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                    ${currentLead.phone
                      ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <span className="text-2xl">💬</span>
                  <span className="text-sm font-medium">WhatsApp</span>
                </button>

                <button
                  onClick={handleSMS}
                  disabled={!currentLead.phone}
                  className={`
                    flex flex-col items-center gap-2 p-4 rounded-xl transition-all
                    ${currentLead.phone
                      ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg hover:shadow-xl'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }
                  `}
                >
                  <span className="text-2xl">📱</span>
                  <span className="text-sm font-medium">SMS</span>
                </button>
              </div>

              {/* Actions secondaires */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setShowPostpone(true)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <span>⏰</span>
                  <span>Reporter</span>
                </button>

                <button
                  onClick={handleSkip}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <span>⏭️</span>
                  <span>Passer</span>
                </button>

                <button
                  onClick={() => navigate(`/leads/${currentLead.id}`)}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <span>👁️</span>
                  <span>Voir fiche</span>
                </button>

                <button
                  onClick={handleScheduleMeeting}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <span>📅</span>
                  <span>Planifier RDV</span>
                </button>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                ${currentIndex === 0
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
                }
              `}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Précédent
            </button>

            <button
              onClick={goNext}
              disabled={currentIndex === totalLeads - 1}
              className={`
                flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all
                ${currentIndex === totalLeads - 1
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
                }
              `}
            >
              Suivant
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Modal Reporter */}
      {showPostpone && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reporter l'action</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nouvelle date
              </label>
              <input
                type="date"
                value={postponeDate}
                onChange={(e) => setPostponeDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowPostpone(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handlePostpone}
                disabled={!postponeDate}
                className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
