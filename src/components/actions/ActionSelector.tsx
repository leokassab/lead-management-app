import { useState, useRef, useEffect } from 'react'
import { LEAD_ACTIONS, getActionConfig, type LeadAction } from '../../types'

interface ActionSelectorProps {
  value: LeadAction | undefined | null
  actionDate?: string | null
  actionNote?: string | null
  onChange: (action: LeadAction, date?: string, note?: string) => void
  disabled?: boolean
}

export default function ActionSelector({
  value,
  actionDate,
  actionNote,
  onChange,
  disabled = false,
}: ActionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [selectedAction, setSelectedAction] = useState<LeadAction | null>(null)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentConfig = getActionConfig(value)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowDatePicker(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleActionSelect = (action: LeadAction) => {
    if (action === 'none' || action === 'do_not_contact' || action === 'waiting_response') {
      onChange(action)
      setIsOpen(false)
      setShowDatePicker(false)
    } else {
      setSelectedAction(action)
      setDate(actionDate ? new Date(actionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0])
      setNote(actionNote || '')
      setShowDatePicker(true)
    }
  }

  const handleConfirm = () => {
    if (selectedAction) {
      onChange(selectedAction, date || undefined, note || undefined)
      setIsOpen(false)
      setShowDatePicker(false)
      setSelectedAction(null)
    }
  }

  const handleCancel = () => {
    setShowDatePicker(false)
    setSelectedAction(null)
  }

  const formatDisplayDate = (dateStr: string) => {
    const d = new Date(dateStr)
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const actionDay = new Date(d.getFullYear(), d.getMonth(), d.getDate())

    if (actionDay.getTime() === today.getTime()) return "Aujourd'hui"
    if (actionDay.getTime() === today.getTime() + 86400000) return 'Demain'
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
          ${currentConfig.bgColor} border-gray-200
        `}
      >
        <span className="text-lg">{currentConfig.icon}</span>
        <span className={`font-medium ${currentConfig.color}`}>{currentConfig.label}</span>
        {actionDate && value !== 'none' && (
          <span className="text-xs text-gray-500">• {formatDisplayDate(actionDate)}</span>
        )}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {!showDatePicker ? (
            <>
              <div className="p-3 border-b border-gray-100 bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-700">Quelle action effectuer ?</h3>
              </div>
              <div className="max-h-80 overflow-y-auto p-2">
                {LEAD_ACTIONS.map((action) => (
                  <button
                    key={action.value}
                    onClick={() => handleActionSelect(action.value)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
                      ${value === action.value ? action.bgColor : 'hover:bg-gray-50'}
                    `}
                  >
                    <span className="text-xl">{action.icon}</span>
                    <span className={`font-medium ${action.color}`}>{action.label}</span>
                    {value === action.value && (
                      <svg className="w-5 h-5 ml-auto text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">{getActionConfig(selectedAction).icon}</span>
                <h3 className="font-semibold text-gray-900">{getActionConfig(selectedAction).label}</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date prévue
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note (optionnel)
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Ex: Rappeler après 14h..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleCancel}
                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
