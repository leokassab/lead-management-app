import { useState } from 'react'
import { Button, Modal } from '../ui'
import { useLeadSequence } from '../../hooks/useLeadSequence'
import { formatDateTime } from '../../utils/formatters'
import { ACTION_TYPE_LABELS } from '../../types/sequences'
import type { Sequence, SequenceStep } from '../../types/sequences'

interface LeadSequenceSectionProps {
  leadId: string
  leadFormationTypeId?: string
}

export default function LeadSequenceSection({ leadId, leadFormationTypeId }: LeadSequenceSectionProps) {
  const {
    leadSequence,
    availableSequences,
    loading,
    enrollLeadInSequence,
    pauseSequence,
    resumeSequence,
    stopSequence,
  } = useLeadSequence(leadId, leadFormationTypeId)

  const [showEnrollModal, setShowEnrollModal] = useState(false)
  const [enrolling, setEnrolling] = useState(false)

  const handleEnroll = async (sequenceId: string) => {
    setEnrolling(true)
    const success = await enrollLeadInSequence(sequenceId)
    if (success) {
      setShowEnrollModal(false)
    }
    setEnrolling(false)
  }

  const handlePause = async () => {
    await pauseSequence()
  }

  const handleResume = async () => {
    await resumeSequence()
  }

  const handleStop = async () => {
    if (confirm('Êtes-vous sûr de vouloir arrêter cette séquence ?')) {
      await stopSequence()
    }
  }

  const renderStepsPreview = (steps: SequenceStep[]) => {
    if (!steps || steps.length === 0) return null

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {steps.slice(0, 5).map((step, index) => {
          const actionConfig = ACTION_TYPE_LABELS[step.action_type]
          return (
            <span
              key={index}
              className="text-sm"
              title={`${actionConfig?.label || step.action_type} - J${step.delay_days}`}
            >
              {actionConfig?.icon || '📌'}
            </span>
          )
        })}
        {steps.length > 5 && (
          <span className="text-xs text-gray-500">+{steps.length - 5}</span>
        )}
      </div>
    )
  }

  const getCurrentStepInfo = () => {
    if (!leadSequence || !leadSequence.sequence) return null

    const steps = leadSequence.sequence.steps || []
    const currentStep = steps[leadSequence.current_step]
    const totalSteps = steps.length

    if (!currentStep) return null

    const actionConfig = ACTION_TYPE_LABELS[currentStep.action_type]

    return {
      current: leadSequence.current_step + 1,
      total: totalSteps,
      icon: actionConfig?.icon || '📌',
      label: actionConfig?.label || currentStep.action_type,
    }
  }

  if (loading) {
    return (
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">🔄 Séquence</h2>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
      </section>
    )
  }

  // Lead is in an active sequence
  if (leadSequence && leadSequence.sequence) {
    const stepInfo = getCurrentStepInfo()

    return (
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">🔄 Séquence</h2>
        <div className="space-y-4">
          {/* Sequence name */}
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              leadSequence.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'
            }`}></span>
            <span className="font-medium text-gray-900">
              {leadSequence.sequence.name}
            </span>
          </div>

          {/* Current step */}
          {stepInfo && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-blue-900">
                <span className="text-lg">{stepInfo.icon}</span>
                <span className="font-medium">
                  Étape {stepInfo.current}/{stepInfo.total} - {stepInfo.label}
                </span>
              </div>
            </div>
          )}

          {/* Next action date */}
          {leadSequence.next_step_at && leadSequence.status === 'active' && (
            <div className="text-sm text-gray-600">
              <span className="text-gray-500">Prochaine action le</span>{' '}
              <span className="font-medium">{formatDateTime(leadSequence.next_step_at)}</span>
            </div>
          )}

          {/* Status badge */}
          {leadSequence.status === 'paused' && (
            <div className="px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm">
              ⏸️ Séquence en pause
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {leadSequence.status === 'active' ? (
              <Button variant="outline" size="sm" onClick={handlePause} className="flex-1">
                ⏸️ Pause
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={handleResume} className="flex-1">
                ▶️ Reprendre
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleStop}
              className="flex-1 text-red-600 hover:bg-red-50"
            >
              ⏹️ Arrêter
            </Button>
          </div>
        </div>
      </section>
    )
  }

  // Lead is not in a sequence
  return (
    <>
      <section className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">🔄 Séquence</h2>
        <p className="text-sm text-gray-500 mb-4">
          Ce lead n'est inscrit dans aucune séquence
        </p>
        <Button
          className="w-full"
          onClick={() => setShowEnrollModal(true)}
          disabled={availableSequences.length === 0}
        >
          + Inscrire dans une séquence
        </Button>
        {availableSequences.length === 0 && (
          <p className="text-xs text-gray-400 mt-2 text-center">
            Aucune séquence active disponible
          </p>
        )}
      </section>

      {/* Enrollment Modal */}
      <EnrollModal
        isOpen={showEnrollModal}
        onClose={() => setShowEnrollModal(false)}
        sequences={availableSequences}
        onEnroll={handleEnroll}
        enrolling={enrolling}
        renderStepsPreview={renderStepsPreview}
      />
    </>
  )
}

// Enrollment Modal Component
function EnrollModal({
  isOpen,
  onClose,
  sequences,
  onEnroll,
  enrolling,
  renderStepsPreview,
}: {
  isOpen: boolean
  onClose: () => void
  sequences: Sequence[]
  onEnroll: (id: string) => void
  enrolling: boolean
  renderStepsPreview: (steps: SequenceStep[]) => React.ReactNode
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔄 Inscrire dans une séquence"
      size="lg"
    >
      <div className="space-y-4">
        {sequences.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Aucune séquence active disponible
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {sequences.map((sequence) => (
              <div
                key={sequence.id}
                className="p-4 border rounded-lg hover:border-blue-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-gray-900">{sequence.name}</h4>
                    {sequence.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {sequence.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center gap-4">
                      {renderStepsPreview(sequence.steps)}
                      <span className="text-xs text-gray-400">
                        {sequence.steps?.length || 0} étape(s)
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onEnroll(sequence.id)}
                    disabled={enrolling}
                  >
                    {enrolling ? '...' : 'Inscrire'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
        </div>
      </div>
    </Modal>
  )
}
