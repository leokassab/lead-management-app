import { useState } from 'react'
import { Button, Badge, Modal } from '../ui'
import {
  scoreLead,
  generateScript,
  updateLeadWithAIAnalysis,
  saveScript,
  suggestNextAction,
} from '../../services/ai'
import { useAuthStore } from '../../stores/authStore'
import type { Lead } from '../../types'

interface AIPanelProps {
  lead: Lead
  onLeadUpdate: () => void
}

type ScriptType = 'phone_call' | 'email_intro' | 'email_followup' | 'linkedin_message'

const SCRIPT_TYPES: { value: ScriptType; label: string; icon: string }[] = [
  { value: 'phone_call', label: 'Appel téléphonique', icon: '📞' },
  { value: 'email_intro', label: 'Email introduction', icon: '✉️' },
  { value: 'email_followup', label: 'Email relance', icon: '📧' },
  { value: 'linkedin_message', label: 'Message LinkedIn', icon: '💼' },
]

export default function AIPanel({ lead, onLeadUpdate }: AIPanelProps) {
  const { profile } = useAuthStore()
  const [analyzing, setAnalyzing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [selectedScriptType, setSelectedScriptType] = useState<ScriptType>('phone_call')
  const [generatedScript, setGeneratedScript] = useState<string | null>(null)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [nextAction, setNextAction] = useState<{ action: string; reason: string; script?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Analyze lead with AI
  const handleAnalyze = async () => {
    setAnalyzing(true)
    setError(null)

    try {
      const result = await scoreLead(lead, profile?.team_id)
      await updateLeadWithAIAnalysis(lead.id, result)
      onLeadUpdate()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'analyse')
    } finally {
      setAnalyzing(false)
    }
  }

  // Generate script
  const handleGenerateScript = async () => {
    setGenerating(true)
    setError(null)

    try {
      const result = await generateScript(lead, selectedScriptType, profile?.team_id)
      setGeneratedScript(result.content)
      setShowScriptModal(true)

      // Save to database
      await saveScript(lead.id, selectedScriptType, result.content, result.personalizationData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setGenerating(false)
    }
  }

  // Suggest next action
  const handleSuggestAction = async () => {
    setError(null)

    try {
      const suggestion = await suggestNextAction(lead, profile?.team_id)
      setNextAction(suggestion)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // Copy script to clipboard
  const handleCopyScript = () => {
    if (generatedScript) {
      navigator.clipboard.writeText(generatedScript)
      alert('Script copié !')
    }
  }

  // Get score color
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-blue-600 bg-blue-100'
    if (score >= 40) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-600 bg-gray-100'
  }

  // Get maturity label
  const getMaturityLabel = (level?: string) => {
    const labels: Record<string, string> = {
      awareness: 'Découverte',
      consideration: 'Considération',
      decision: 'Décision',
    }
    return labels[level || ''] || 'Non défini'
  }

  // Get action label
  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      call_back: '📞 Rappeler',
      send_proposal: '📄 Envoyer proposition',
      follow_up: '📧 Relancer',
      meeting: '📅 Planifier RDV',
    }
    return labels[action] || action
  }

  // Parse recommendations
  const recommendations = lead.ai_recommendations?.split('\n').filter(Boolean) || []

  return (
    <div className="space-y-6">
      {/* Error display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* AI Score Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-xl">🤖</span>
            Score IA
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAnalyze}
            disabled={analyzing}
          >
            {analyzing ? 'Analyse...' : lead.ai_analyzed ? '🔄 Réanalyser' : '✨ Analyser'}
          </Button>
        </div>

        {lead.ai_analyzed ? (
          <div className="space-y-4">
            {/* Score display */}
            <div className="flex items-center gap-6">
              <div className={`text-4xl font-bold px-4 py-2 rounded-lg ${getScoreColor(lead.ai_score || 0)}`}>
                {lead.ai_score || 0}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Conversion:</span>
                    <span className="ml-1 font-medium">{lead.conversion_probability || 0}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Maturité:</span>
                    <Badge className="ml-1">{getMaturityLabel(lead.maturity_level)}</Badge>
                  </div>
                </div>
                <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-blue-500 to-green-500"
                    style={{ width: `${lead.ai_score || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Recommandations</h4>
                <ul className="space-y-1">
                  {recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="text-green-500">✓</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Objections */}
            {lead.ai_objections && lead.ai_objections.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Objections probables</h4>
                <div className="space-y-2">
                  {lead.ai_objections.map((obj, i) => (
                    <div key={i} className="p-3 bg-gray-50 rounded-lg text-sm">
                      <div className="font-medium text-gray-900">❓ {obj.objection}</div>
                      <div className="text-gray-600 mt-1">💬 {obj.response}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🎯</div>
            <p>Aucune analyse IA effectuée</p>
            <p className="text-sm mt-1">Cliquez sur "Analyser" pour obtenir un score et des recommandations</p>
          </div>
        )}
      </div>

      {/* Script Generation Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="font-semibold flex items-center gap-2 mb-4">
          <span className="text-xl">📝</span>
          Génération de scripts
        </h3>

        <div className="flex flex-wrap gap-2 mb-4">
          {SCRIPT_TYPES.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedScriptType(type.value)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedScriptType === type.value
                  ? 'bg-blue-100 text-blue-700 border-2 border-blue-300'
                  : 'bg-gray-100 text-gray-600 border-2 border-transparent hover:bg-gray-200'
              }`}
            >
              {type.icon} {type.label}
            </button>
          ))}
        </div>

        <Button
          onClick={handleGenerateScript}
          disabled={generating}
          className="w-full"
        >
          {generating ? '✨ Génération en cours...' : `✨ Générer ${SCRIPT_TYPES.find(t => t.value === selectedScriptType)?.label}`}
        </Button>
      </div>

      {/* Next Action Suggestion */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <span className="text-xl">💡</span>
            Prochaine action suggérée
          </h3>
          <Button variant="outline" size="sm" onClick={handleSuggestAction}>
            Suggérer
          </Button>
        </div>

        {nextAction ? (
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2 text-lg font-medium text-blue-700">
              {getActionLabel(nextAction.action)}
            </div>
            <p className="text-sm text-gray-600 mt-2">{nextAction.reason}</p>
            {nextAction.script && (
              <div className="mt-3 p-3 bg-white rounded border text-sm">
                <div className="text-xs text-gray-500 mb-1">Phrase d'accroche suggérée:</div>
                "{nextAction.script}"
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            Cliquez sur "Suggérer" pour obtenir une recommandation d'action
          </div>
        )}
      </div>

      {/* Script Modal */}
      <Modal
        isOpen={showScriptModal}
        onClose={() => setShowScriptModal(false)}
        title={`${SCRIPT_TYPES.find(t => t.value === selectedScriptType)?.icon} ${SCRIPT_TYPES.find(t => t.value === selectedScriptType)?.label}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm font-sans">{generatedScript}</pre>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowScriptModal(false)}>
              Fermer
            </Button>
            <Button variant="outline" onClick={handleCopyScript}>
              📋 Copier
            </Button>
            <Button onClick={() => {
              handleCopyScript()
              setShowScriptModal(false)
            }}>
              ✓ Utiliser ce script
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
