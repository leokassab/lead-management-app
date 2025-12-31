import { useState } from 'react'
import { Modal, Button } from '../ui'
import { useLostReasons } from '../../hooks/useLostReasons'

interface LostReasonModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (reason: string, details?: string) => void
  leadName?: string
}

export default function LostReasonModal({
  isOpen,
  onClose,
  onConfirm,
  leadName,
}: LostReasonModalProps) {
  const { lostReasons, loading } = useLostReasons()
  const [selectedReason, setSelectedReason] = useState('')
  const [customReason, setCustomReason] = useState('')
  const [details, setDetails] = useState('')
  const [error, setError] = useState('')

  const isOtherSelected = selectedReason === 'Autre'

  const handleConfirm = () => {
    // Validation
    if (!selectedReason) {
      setError('Veuillez sélectionner une raison')
      return
    }

    if (isOtherSelected && !customReason.trim()) {
      setError('Veuillez préciser la raison')
      return
    }

    const finalReason = isOtherSelected ? `Autre: ${customReason.trim()}` : selectedReason
    onConfirm(finalReason, details.trim() || undefined)

    // Reset form
    setSelectedReason('')
    setCustomReason('')
    setDetails('')
    setError('')
  }

  const handleClose = () => {
    // Reset form
    setSelectedReason('')
    setCustomReason('')
    setDetails('')
    setError('')
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Raison de la perte"
      size="md"
    >
      <div className="space-y-6">
        {/* Lead name */}
        {leadName && (
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Vous êtes sur le point de marquer comme perdu :
            </p>
            <p className="font-medium text-gray-900 mt-1">{leadName}</p>
          </div>
        )}

        {/* Reasons list */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Pourquoi ce lead est-il perdu ? <span className="text-red-500">*</span>
          </label>

          {loading ? (
            <div className="text-center py-4 text-gray-500">Chargement...</div>
          ) : (
            <div className="space-y-2">
              {lostReasons.map((reason) => (
                <label
                  key={reason.id}
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedReason === reason.name
                      ? 'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="lostReason"
                    value={reason.name}
                    checked={selectedReason === reason.name}
                    onChange={(e) => {
                      setSelectedReason(e.target.value)
                      setError('')
                    }}
                    className="w-4 h-4 text-red-600 focus:ring-red-500"
                  />
                  <span className="text-gray-900">{reason.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Custom reason input (when "Autre" is selected) */}
        {isOtherSelected && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Précisez la raison <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={customReason}
              onChange={(e) => {
                setCustomReason(e.target.value)
                setError('')
              }}
              placeholder="Entrez la raison..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
              autoFocus
            />
          </div>
        )}

        {/* Additional details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Détails supplémentaires (optionnel)
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder="Ajoutez des informations complémentaires..."
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
          />
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={handleClose}>
            Annuler
          </Button>
          <Button
            onClick={handleConfirm}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Confirmer la perte
          </Button>
        </div>
      </div>
    </Modal>
  )
}
