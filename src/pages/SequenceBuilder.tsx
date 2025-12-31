import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '../components/ui'
import { useSequences, useSequence } from '../hooks/useSequences'
import {
  type SequenceStep,
  type StopCondition,
  type SequenceActionType,
  type StepConditions,
  ACTION_TYPE_LABELS,
  createDefaultStep,
  DEFAULT_STOP_CONDITIONS,
} from '../types/sequences'

// Sortable Step Card Component
function SortableStepCard({
  step,
  index,
  onUpdate,
  onDelete,
  onConditionsChange,
}: {
  step: SequenceStep
  index: number
  onUpdate: (index: number, updates: Partial<SequenceStep>) => void
  onDelete: (index: number) => void
  onConditionsChange: (index: number, conditions: StepConditions) => void
}) {
  const [showConditions, setShowConditions] = useState(false)

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `step-${step.order}` })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const actionTypes: SequenceActionType[] = ['call', 'email', 'sms', 'whatsapp', 'linkedin', 'task']

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white border rounded-lg p-4 ${
        isDragging ? 'shadow-lg opacity-90 z-50' : 'shadow-sm'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <button
          {...attributes}
          {...listeners}
          className="mt-2 p-1 hover:bg-gray-100 rounded cursor-grab active:cursor-grabbing text-gray-400"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="1.5" />
            <circle cx="15" cy="6" r="1.5" />
            <circle cx="9" cy="12" r="1.5" />
            <circle cx="15" cy="12" r="1.5" />
            <circle cx="9" cy="18" r="1.5" />
            <circle cx="15" cy="18" r="1.5" />
          </svg>
        </button>

        {/* Step Content */}
        <div className="flex-1 space-y-3">
          {/* Step Number & Delay */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-500">
              Étape {index + 1}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Après</span>
              <input
                type="number"
                min="0"
                value={step.delay_days}
                onChange={(e) => onUpdate(index, { delay_days: parseInt(e.target.value) || 0 })}
                className="w-16 px-2 py-1 border rounded text-sm text-center"
              />
              <span className="text-sm text-gray-500">jour(s)</span>
              {step.delay_hours > 0 && (
                <>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    value={step.delay_hours}
                    onChange={(e) => onUpdate(index, { delay_hours: parseInt(e.target.value) || 0 })}
                    className="w-16 px-2 py-1 border rounded text-sm text-center"
                  />
                  <span className="text-sm text-gray-500">h</span>
                </>
              )}
            </div>
          </div>

          {/* Action Type & Config */}
          <div className="flex items-start gap-4">
            <select
              value={step.action_type}
              onChange={(e) => onUpdate(index, {
                action_type: e.target.value as SequenceActionType,
                action_config: {}
              })}
              className="px-3 py-2 border rounded-lg text-sm bg-white"
            >
              {actionTypes.map((type) => (
                <option key={type} value={type}>
                  {ACTION_TYPE_LABELS[type].icon} {ACTION_TYPE_LABELS[type].label}
                </option>
              ))}
            </select>

            {/* Dynamic Config Based on Action Type */}
            <div className="flex-1">
              {(step.action_type === 'email' || step.action_type === 'sms') && (
                <select
                  value={step.action_config.template_id || ''}
                  onChange={(e) => onUpdate(index, {
                    action_config: { ...step.action_config, template_id: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">Sélectionner un template...</option>
                  <option value="template-1">Template 1 - Premier contact</option>
                  <option value="template-2">Template 2 - Relance</option>
                  <option value="template-3">Template 3 - Dernière relance</option>
                </select>
              )}

              {(step.action_type === 'whatsapp' || step.action_type === 'linkedin') && (
                <textarea
                  value={step.action_config.message || ''}
                  onChange={(e) => onUpdate(index, {
                    action_config: { ...step.action_config, message: e.target.value }
                  })}
                  placeholder={`Message ${ACTION_TYPE_LABELS[step.action_type].label}...`}
                  className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                  rows={2}
                />
              )}

              {step.action_type === 'task' && (
                <input
                  type="text"
                  value={step.action_config.task_description || ''}
                  onChange={(e) => onUpdate(index, {
                    action_config: { ...step.action_config, task_description: e.target.value }
                  })}
                  placeholder="Description de la tâche..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              )}

              {step.action_type === 'call' && (
                <input
                  type="text"
                  value={step.name || ''}
                  onChange={(e) => onUpdate(index, { name: e.target.value })}
                  placeholder="Note pour l'appel..."
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                />
              )}
            </div>
          </div>

          {/* Conditions badges */}
          {step.conditions && Object.values(step.conditions).some(Boolean) && (
            <div className="flex items-center gap-2 flex-wrap">
              {step.conditions.only_if_no_response && (
                <span className="px-2 py-1 bg-blue-50 text-blue-600 text-xs rounded">
                  Si pas de réponse
                </span>
              )}
              {step.conditions.only_business_hours && (
                <span className="px-2 py-1 bg-green-50 text-green-600 text-xs rounded">
                  Heures ouvrées
                </span>
              )}
              {step.conditions.skip_weekends && (
                <span className="px-2 py-1 bg-orange-50 text-orange-600 text-xs rounded">
                  Pas le weekend
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Conditions Button */}
          <div className="relative">
            <button
              onClick={() => setShowConditions(!showConditions)}
              className={`p-2 rounded-lg transition-colors ${
                showConditions ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500'
              }`}
              title="Conditions"
            >
              <span className="text-lg">⚙️</span>
            </button>

            {/* Conditions Popover */}
            {showConditions && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowConditions(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-lg shadow-lg border z-20 p-4">
                  <h4 className="font-medium text-gray-900 mb-3">Conditions</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={step.conditions?.only_if_no_response || false}
                        onChange={(e) => onConditionsChange(index, {
                          ...step.conditions,
                          only_if_no_response: e.target.checked,
                        })}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Seulement si pas de réponse</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={step.conditions?.only_business_hours || false}
                        onChange={(e) => onConditionsChange(index, {
                          ...step.conditions,
                          only_business_hours: e.target.checked,
                        })}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Heures ouvrées uniquement</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={step.conditions?.skip_weekends || false}
                        onChange={(e) => onConditionsChange(index, {
                          ...step.conditions,
                          skip_weekends: e.target.checked,
                        })}
                        className="rounded border-gray-300 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Pas le weekend</span>
                    </label>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Delete Button */}
          <button
            onClick={() => onDelete(index)}
            className="p-2 hover:bg-red-50 rounded-lg text-gray-500 hover:text-red-600 transition-colors"
            title="Supprimer"
          >
            <span className="text-lg">🗑️</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// Timeline Preview Component
function TimelinePreview({ steps }: { steps: SequenceStep[] }) {
  if (steps.length === 0) return null

  let cumulativeDays = 0

  return (
    <div className="space-y-2">
      {steps.map((step, index) => {
        cumulativeDays += step.delay_days
        const actionConfig = ACTION_TYPE_LABELS[step.action_type]

        return (
          <div key={index} className="flex items-center gap-3">
            <div className="w-12 text-right text-sm font-medium text-gray-500">
              J{cumulativeDays}
            </div>
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm">
              {actionConfig.icon}
            </div>
            <div className="flex-1 text-sm text-gray-700">
              {actionConfig.label}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Main Component
export default function SequenceBuilder() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)

  const { createSequence, updateSequence } = useSequences()
  const { sequence: existingSequence, loading: loadingSequence } = useSequence(id)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<SequenceStep[]>([createDefaultStep(1)])
  const [stopConditions, setStopConditions] = useState<StopCondition[]>(DEFAULT_STOP_CONDITIONS)
  const [active, setActive] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load existing sequence for editing
  useEffect(() => {
    if (existingSequence) {
      setName(existingSequence.name)
      setDescription(existingSequence.description || '')
      setSteps(existingSequence.steps.length > 0 ? existingSequence.steps : [createDefaultStep(1)])
      setStopConditions(existingSequence.stop_conditions || DEFAULT_STOP_CONDITIONS)
      setActive(existingSequence.active)
    }
  }, [existingSequence])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      const oldIndex = steps.findIndex((s) => `step-${s.order}` === active.id)
      const newIndex = steps.findIndex((s) => `step-${s.order}` === over.id)

      const newSteps = arrayMove(steps, oldIndex, newIndex).map((step, idx) => ({
        ...step,
        order: idx + 1,
      }))
      setSteps(newSteps)
    }
  }

  const handleUpdateStep = (index: number, updates: Partial<SequenceStep>) => {
    setSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    )
  }

  const handleDeleteStep = (index: number) => {
    if (steps.length <= 1) return
    setSteps((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((step, idx) => ({ ...step, order: idx + 1 }))
    )
  }

  const handleConditionsChange = (index: number, conditions: StepConditions) => {
    handleUpdateStep(index, { conditions })
  }

  const handleAddStep = () => {
    const newOrder = steps.length + 1
    setSteps((prev) => [...prev, createDefaultStep(newOrder)])
  }

  const toggleStopCondition = (condition: StopCondition) => {
    setStopConditions((prev) =>
      prev.includes(condition)
        ? prev.filter((c) => c !== condition)
        : [...prev, condition]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      alert('Veuillez entrer un nom pour la séquence')
      return
    }

    setSaving(true)
    try {
      const data = {
        name: name.trim(),
        description: description.trim() || undefined,
        steps,
        stop_conditions: stopConditions,
        active,
      }

      if (isEditing && id) {
        await updateSequence(id, data)
      } else {
        await createSequence(data)
      }

      navigate('/sequences')
    } catch (error) {
      console.error('Error saving sequence:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  if (isEditing && loadingSequence) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-30 bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/sequences')}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              {isEditing ? 'Modifier la séquence' : 'Nouvelle séquence'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate('/sequences')}
            >
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Builder (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Name & Description */}
            <div className="bg-white rounded-lg shadow-sm p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nom de la séquence *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Relance prospects chauds"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez l'objectif de cette séquence..."
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  rows={2}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Étapes de la séquence
              </h2>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={steps.map((s) => `step-${s.order}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <SortableStepCard
                        key={`step-${step.order}`}
                        step={step}
                        index={index}
                        onUpdate={handleUpdateStep}
                        onDelete={handleDeleteStep}
                        onConditionsChange={handleConditionsChange}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <button
                onClick={handleAddStep}
                className="mt-4 w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
              >
                <span className="text-xl">+</span>
                Ajouter une étape
              </button>
            </div>
          </div>

          {/* Right Column - Config (1/3) */}
          <div className="space-y-6">
            {/* Stop Conditions */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Conditions d'arrêt
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                La séquence s'arrête automatiquement si :
              </p>
              <div className="space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stopConditions.includes('replied')}
                    onChange={() => toggleStopCondition('replied')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Le lead répond</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stopConditions.includes('meeting_scheduled')}
                    onChange={() => toggleStopCondition('meeting_scheduled')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">RDV planifié</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stopConditions.includes('unsubscribed')}
                    onChange={() => toggleStopCondition('unsubscribed')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Désinscription</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stopConditions.includes('do_not_contact')}
                    onChange={() => toggleStopCondition('do_not_contact')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Marqué "Ne plus contacter"</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={stopConditions.includes('converted')}
                    onChange={() => toggleStopCondition('converted')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Lead converti</span>
                </label>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">Activer la séquence</h3>
                  <p className="text-sm text-gray-500">
                    Les leads pourront être inscrits
                  </p>
                </div>
                <button
                  onClick={() => setActive(!active)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Timeline Preview */}
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Aperçu timeline
              </h2>
              {steps.length > 0 ? (
                <TimelinePreview steps={steps} />
              ) : (
                <p className="text-sm text-gray-500">
                  Ajoutez des étapes pour voir l'aperçu
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
