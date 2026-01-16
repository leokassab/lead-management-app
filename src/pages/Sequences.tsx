import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Badge } from '../components/ui'
import { useSequences } from '../hooks/useSequences'
import { useFormationTypes } from '../hooks/useFormationTypes'
import { ACTION_TYPE_LABELS } from '../types/sequences'
import type { Sequence, SequenceStep } from '../types/sequences'

export default function Sequences() {
  const navigate = useNavigate()
  const {
    sequences,
    loading,
    error,
    toggleSequenceActive,
    duplicateSequence,
    deleteSequence,
  } = useSequences()

  const { formationTypes, activeFormationTypes } = useFormationTypes()

  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [formationFilter, setFormationFilter] = useState<string[]>([])
  const [showFormationDropdown, setShowFormationDropdown] = useState(false)

  // Filter sequences by formation type
  const filteredSequences = useMemo(() => {
    if (formationFilter.length === 0) return sequences

    return sequences.filter(seq => {
      // If sequence has no formation types, it matches all
      if (!seq.formation_type_ids || seq.formation_type_ids.length === 0) return true
      // Check if any of the sequence's formation types are in the filter
      return seq.formation_type_ids.some(id => formationFilter.includes(id))
    })
  }, [sequences, formationFilter])

  const handleToggleActive = async (sequence: Sequence) => {
    await toggleSequenceActive(sequence.id, !sequence.active)
  }

  const handleDuplicate = async (sequence: Sequence) => {
    setMenuOpenId(null)
    await duplicateSequence(sequence)
  }

  const handleDelete = async (sequence: Sequence) => {
    setMenuOpenId(null)
    if (confirm(`Êtes-vous sûr de vouloir supprimer la séquence "${sequence.name}" ?`)) {
      await deleteSequence(sequence.id)
    }
  }

  const renderStepsBadges = (steps: SequenceStep[]) => {
    if (!steps || steps.length === 0) {
      return <span className="text-gray-400 text-sm">Aucune étape</span>
    }

    return (
      <div className="flex items-center gap-1 flex-wrap">
        {steps.slice(0, 6).map((step, index) => {
          const actionConfig = ACTION_TYPE_LABELS[step.action_type]
          const delay = step.delay_days > 0 ? `J${step.delay_days}` : step.delay_hours > 0 ? `${step.delay_hours}h` : 'J0'

          return (
            <div key={index} className="flex items-center">
              <span
                className="px-2 py-1 bg-gray-100 rounded text-xs font-medium flex items-center gap-1"
                title={`${actionConfig?.label || step.action_type} - ${delay}`}
              >
                <span>{actionConfig?.icon || '📌'}</span>
                <span className="text-gray-600">{delay}</span>
              </span>
              {index < Math.min(steps.length - 1, 5) && (
                <span className="text-gray-300 mx-1">→</span>
              )}
            </div>
          )
        })}
        {steps.length > 6 && (
          <span className="text-xs text-gray-500 ml-1">+{steps.length - 6} étapes</span>
        )}
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-900">Séquences automatiques</h1>
          <p className="text-gray-600 mt-1">
            Automatisez vos relances avec des séquences multi-étapes
          </p>
        </div>
        <Button onClick={() => navigate('/sequences/new')}>
          + Nouvelle séquence
        </Button>
      </div>

      {/* Filters */}
      {activeFormationTypes.length > 0 && (
        <div className="flex items-center gap-4">
          <div className="relative">
            <button
              onClick={() => setShowFormationDropdown(!showFormationDropdown)}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-sm flex items-center gap-2 hover:border-gray-400"
            >
              🎓 Formation {formationFilter.length > 0 && <span className="bg-blue-100 text-blue-700 px-1.5 rounded">{formationFilter.length}</span>}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showFormationDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFormationDropdown(false)} />
                <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-48 max-h-64 overflow-y-auto">
                  {activeFormationTypes.map(ft => (
                    <label key={ft.id} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formationFilter.includes(ft.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormationFilter([...formationFilter, ft.id])
                          } else {
                            setFormationFilter(formationFilter.filter(f => f !== ft.id))
                          }
                        }}
                        className="rounded border-gray-300"
                      />
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: ft.color }} />
                      <span className="text-sm">{ft.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          {formationFilter.length > 0 && (
            <button
              onClick={() => setFormationFilter([])}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Effacer le filtre
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}

      {/* Empty state */}
      {filteredSequences.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">🔄</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {sequences.length === 0 ? 'Créez votre première séquence' : 'Aucune séquence trouvée'}
          </h2>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            {sequences.length === 0
              ? 'Les séquences automatiques vous permettent de programmer des actions de relance sur plusieurs jours pour vos leads.'
              : 'Aucune séquence ne correspond au filtre sélectionné.'
            }
          </p>
          {sequences.length === 0 ? (
            <Button onClick={() => navigate('/sequences/new')} size="lg">
              + Créer une séquence
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setFormationFilter([])}>
              Effacer le filtre
            </Button>
          )}
        </div>
      ) : (
        /* Sequences list */
        <div className="grid gap-4">
          {filteredSequences.map((sequence) => (
            <div
              key={sequence.id}
              className={`bg-white rounded-lg shadow p-6 border-l-4 transition-colors ${
                sequence.active ? 'border-green-500' : 'border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between">
                {/* Left side - Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                      {sequence.name}
                    </h3>
                    <Badge className={sequence.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}>
                      {sequence.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>

                  {/* Formation Types Badges */}
                  {sequence.formation_type_ids && sequence.formation_type_ids.length > 0 && (
                    <div className="flex items-center gap-1 mb-2 flex-wrap">
                      <span className="text-xs text-gray-500 mr-1">🎓</span>
                      {sequence.formation_type_ids.map(ftId => {
                        const ft = formationTypes.find(f => f.id === ftId)
                        return ft ? (
                          <span
                            key={ftId}
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium text-white"
                            style={{ backgroundColor: ft.color }}
                          >
                            {ft.name}
                          </span>
                        ) : null
                      })}
                    </div>
                  )}

                  {sequence.description && (
                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                      {sequence.description}
                    </p>
                  )}

                  {/* Steps preview */}
                  <div className="mb-4">
                    {renderStepsBadges(sequence.steps)}
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Inscrits:</span>
                      <span className="font-medium">{sequence.total_enrolled}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">En cours:</span>
                      <span className="font-medium text-blue-600">
                        {sequence.total_enrolled - sequence.total_completed - sequence.total_converted}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Terminés:</span>
                      <span className="font-medium">{sequence.total_completed}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-gray-500">Convertis:</span>
                      <span className="font-medium text-green-600">{sequence.total_converted}</span>
                    </div>
                  </div>
                </div>

                {/* Right side - Actions */}
                <div className="flex items-center gap-3 ml-4">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggleActive(sequence)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      sequence.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                    title={sequence.active ? 'Désactiver' : 'Activer'}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        sequence.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>

                  {/* Menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpenId(menuOpenId === sequence.id ? null : sequence.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <span className="text-gray-500">⋮</span>
                    </button>

                    {menuOpenId === sequence.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpenId(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border z-20">
                          <button
                            onClick={() => {
                              setMenuOpenId(null)
                              navigate(`/sequences/${sequence.id}`)
                            }}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            ✏️ Modifier
                          </button>
                          <button
                            onClick={() => handleDuplicate(sequence)}
                            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
                          >
                            📋 Dupliquer
                          </button>
                          <hr className="my-1" />
                          <button
                            onClick={() => handleDelete(sequence)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            🗑️ Supprimer
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
