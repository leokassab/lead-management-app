import { useState, useEffect } from 'react'
import { Button, Badge, Modal } from '../ui'
import {
  generateScript,
  saveScript,
  getTeamAIConfig,
  getLeadScripts,
  markScriptAsUsed,
  rateScript,
} from '../../services/ai'
import { useAIAnalysis } from '../../hooks/useAIAnalysis'
import { useAuthStore } from '../../stores/authStore'
import { formatDate } from '../../utils/formatters'
import { getActionConfig } from '../../types'
import type { Lead, AIConfig, LeadAction, Script } from '../../types'
import { DEFAULT_AI_CONFIG } from '../../types'
import AIHistoryTimeline from './AIHistoryTimeline'

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
  const {
    analyzing,
    suggesting,
    error,
    analyzeLead,
    suggestNextAction,
    applyAction,
    clearError,
  } = useAIAnalysis()

  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG)
  const [generating, setGenerating] = useState(false)
  const [selectedScriptType, setSelectedScriptType] = useState<ScriptType>('phone_call')
  const [generatedScript, setGeneratedScript] = useState<string | null>(null)
  const [showScriptModal, setShowScriptModal] = useState(false)
  const [suggestedAction, setSuggestedAction] = useState<{ action: LeadAction; reason: string } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [savedScripts, setSavedScripts] = useState<Script[]>([])
  const [currentScript, setCurrentScript] = useState<Script | null>(null)
  const [scriptsOpen, setScriptsOpen] = useState(false)

  // Load AI config
  useEffect(() => {
    const loadConfig = async () => {
      if (profile?.team_id) {
        const config = await getTeamAIConfig(profile.team_id)
        setAIConfig(config)
      }
    }
    loadConfig()
  }, [profile?.team_id])

  // Load saved scripts for this lead
  useEffect(() => {
    const loadScripts = async () => {
      const scripts = await getLeadScripts(lead.id)
      setSavedScripts(scripts)
      // Auto-open if there are scripts
      if (scripts.length > 0) {
        setScriptsOpen(true)
      }
    }
    loadScripts()
  }, [lead.id])

  // Analyze lead with AI
  const handleAnalyze = async (isRescore: boolean = false) => {
    clearError()
    const result = await analyzeLead(lead, isRescore)
    if (result) {
      onLeadUpdate()
    }
  }

  // Generate script
  const handleGenerateScript = async () => {
    setGenerating(true)

    try {
      const result = await generateScript(lead, selectedScriptType, profile?.team_id)
      setGeneratedScript(result.content)
      const savedScript = await saveScript(
        lead.id,
        selectedScriptType,
        result.content,
        result.personalizationData,
        result.generationContext
      )
      if (savedScript) {
        setCurrentScript(savedScript)
        setSavedScripts(prev => [savedScript, ...prev])
      }
      setShowScriptModal(true)
    } catch (err) {
      console.error('Error generating script:', err)
    } finally {
      setGenerating(false)
    }
  }

  // Mark script as used with optional rating
  const handleMarkUsed = async (script: Script, rating?: number) => {
    const success = await markScriptAsUsed(script.id, rating)
    if (success) {
      setSavedScripts(prev =>
        prev.map(s =>
          s.id === script.id
            ? { ...s, used: true, used_at: new Date().toISOString(), effectiveness_rating: rating }
            : s
        )
      )
    }
  }

  // Rate a script
  const handleRateScript = async (script: Script, rating: number) => {
    const success = await rateScript(script.id, rating)
    if (success) {
      setSavedScripts(prev =>
        prev.map(s =>
          s.id === script.id ? { ...s, effectiveness_rating: rating } : s
        )
      )
    }
  }

  // Build context display string
  const buildContextDisplay = (script: Script): string => {
    const parts: string[] = []
    const ctx = script.generation_context

    if (ctx?.source) parts.push(ctx.source)
    if (ctx?.campaign) parts.push(ctx.campaign)
    if (ctx?.product_interest) parts.push(ctx.product_interest)
    if (ctx?.lead_type) parts.push(`Profil ${ctx.lead_type}`)

    return parts.join(', ') || 'Informations du lead'
  }

  // Suggest next action
  const handleSuggestAction = async () => {
    const suggestion = await suggestNextAction(lead)
    if (suggestion) {
      setSuggestedAction(suggestion)
    }
  }

  // Apply suggested action
  const handleApplyAction = async () => {
    if (!suggestedAction) return

    const success = await applyAction(lead.id, suggestedAction.action, suggestedAction.reason)
    if (success) {
      onLeadUpdate()
      setSuggestedAction(null)
    }
  }

  // Apply AI recommended action
  const handleApplyRecommendedAction = async () => {
    if (!lead.ai_recommended_action) return

    const success = await applyAction(
      lead.id,
      lead.ai_recommended_action,
      'Action recommandée par l\'IA'
    )
    if (success) {
      onLeadUpdate()
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

      {/* AI Insights Section */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-lg shadow p-6 border border-indigo-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2 text-indigo-900">
            <span className="text-xl">🤖</span>
            Insights IA
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAnalyze(lead.ai_analyzed)}
            disabled={analyzing}
            className="border-indigo-300 text-indigo-700 hover:bg-indigo-100"
          >
            {analyzing ? '⏳ Analyse...' : '🔄 Recalculer le score'}
          </Button>
        </div>

        {lead.ai_analyzed ? (
          <div className="space-y-4">
            {/* Analysis date */}
            {lead.ai_analysis_date && (
              <div className="text-sm text-indigo-600">
                Analysé le {formatDate(lead.ai_analysis_date)}
              </div>
            )}

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
                    className="h-2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500"
                    style={{ width: `${lead.ai_score || 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Reasoning */}
            {lead.ai_reasoning && (
              <div className="p-4 bg-white rounded-lg border border-indigo-100">
                <h4 className="text-sm font-medium text-indigo-700 mb-2">💡 Pourquoi ce score ?</h4>
                <p className="text-gray-700 text-sm">{lead.ai_reasoning}</p>
              </div>
            )}

            {/* Recommended action */}
            {lead.ai_recommended_action && !aiConfig.auto_action_recommendation && (
              <div className="p-4 bg-white rounded-lg border border-indigo-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-indigo-700 mb-1">Action recommandée</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{getActionConfig(lead.ai_recommended_action).icon}</span>
                      <span className="font-medium">{getActionConfig(lead.ai_recommended_action).label}</span>
                    </div>
                  </div>
                  {lead.current_action !== lead.ai_recommended_action && (
                    <Button
                      size="sm"
                      onClick={handleApplyRecommendedAction}
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      💡 Appliquer
                    </Button>
                  )}
                </div>
              </div>
            )}

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
                    <div key={i} className="p-3 bg-white rounded-lg text-sm border">
                      <div className="font-medium text-gray-900">❓ {obj.objection}</div>
                      <div className="text-gray-600 mt-1">💬 {obj.response}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI History Accordion */}
            <div className="border-t border-indigo-100 pt-4">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors"
              >
                <span className="font-medium text-indigo-700 flex items-center gap-2">
                  <span>📜</span>
                  Historique des analyses
                </span>
                <span className={`transform transition-transform ${historyOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {historyOpen && (
                <div className="mt-3 p-4 bg-white rounded-lg border border-indigo-100">
                  <AIHistoryTimeline leadId={lead.id} />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center py-8 text-gray-500">
              <div className="text-4xl mb-2">🎯</div>
              <p>Aucune analyse IA effectuée</p>
              <p className="text-sm mt-1">Cliquez sur "Recalculer le score" pour obtenir des insights</p>
            </div>

            {/* AI History Accordion - also show when no analysis yet */}
            <div className="border-t border-indigo-100 pt-4">
              <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border border-indigo-100 hover:bg-indigo-50 transition-colors"
              >
                <span className="font-medium text-indigo-700 flex items-center gap-2">
                  <span>📜</span>
                  Historique des analyses
                </span>
                <span className={`transform transition-transform ${historyOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {historyOpen && (
                <div className="mt-3 p-4 bg-white rounded-lg border border-indigo-100">
                  <AIHistoryTimeline leadId={lead.id} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Suggest Action Section (only if auto_action_recommendation is OFF) */}
      {!aiConfig.auto_action_recommendation && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <span className="text-xl">💡</span>
              Suggérer une action
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSuggestAction}
              disabled={suggesting}
            >
              {suggesting ? '⏳ Analyse...' : 'Suggérer'}
            </Button>
          </div>

          {suggestedAction ? (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 text-lg font-medium text-blue-700">
                    {getActionConfig(suggestedAction.action).icon}
                    {getActionConfig(suggestedAction.action).label}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{suggestedAction.reason}</p>
                </div>
                <Button
                  size="sm"
                  onClick={handleApplyAction}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Appliquer
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">
              Cliquez sur "Suggérer" pour obtenir une recommandation d'action personnalisée
            </div>
          )}
        </div>
      )}

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

        {/* Saved Scripts Accordion */}
        {savedScripts.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <button
              onClick={() => setScriptsOpen(!scriptsOpen)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <span className="font-medium text-gray-700 flex items-center gap-2">
                <span>📂</span>
                Scripts générés ({savedScripts.length})
              </span>
              <span className={`transform transition-transform ${scriptsOpen ? 'rotate-180' : ''}`}>
                ▼
              </span>
            </button>

            {scriptsOpen && (
              <div className="mt-3 space-y-3">
                {savedScripts.map((script) => {
                  const typeConfig = SCRIPT_TYPES.find(t => t.value === script.script_type)

                  return (
                    <div
                      key={script.id}
                      className={`p-4 rounded-lg border ${
                        script.used ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                      }`}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span>{typeConfig?.icon}</span>
                          <span className="font-medium text-sm">{typeConfig?.label}</span>
                          {script.used && (
                            <Badge className="bg-green-100 text-green-700 text-xs">Utilisé</Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDate(script.generated_at)}
                        </span>
                      </div>

                      {/* Context info */}
                      <div className="text-xs text-gray-500 mb-2">
                        Basé sur : {buildContextDisplay(script)}
                      </div>

                      {/* Preview */}
                      <div className="bg-gray-50 rounded p-2 text-sm text-gray-700 line-clamp-3 mb-3">
                        {script.generated_content.substring(0, 150)}...
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setGeneratedScript(script.generated_content)
                              setCurrentScript(script)
                              setShowScriptModal(true)
                            }}
                          >
                            👁️ Voir
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(script.generated_content)
                              alert('Script copié !')
                            }}
                          >
                            📋 Copier
                          </Button>
                          {!script.used && (
                            <Button
                              size="sm"
                              onClick={() => handleMarkUsed(script)}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              ✅ Marquer utilisé
                            </Button>
                          )}
                        </div>

                        {/* Rating stars */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() => handleRateScript(script, star)}
                              className={`text-lg transition-colors ${
                                (script.effectiveness_rating || 0) >= star
                                  ? 'text-yellow-400'
                                  : 'text-gray-300 hover:text-yellow-300'
                              }`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
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
          {/* Context info */}
          {currentScript?.generation_context && (
            <div className="text-sm text-gray-600 bg-blue-50 rounded-lg p-3 border border-blue-100">
              <span className="font-medium">Généré le {currentScript ? formatDate(currentScript.generated_at) : ''}</span>
              <span className="mx-2">•</span>
              <span>Basé sur : {currentScript ? buildContextDisplay(currentScript) : ''}</span>
            </div>
          )}

          <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap text-sm font-sans">{generatedScript}</pre>
          </div>

          {/* Rating in modal */}
          {currentScript && (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="text-sm text-gray-600">Noter ce script :</span>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => handleRateScript(currentScript, star)}
                  className={`text-2xl transition-colors ${
                    (currentScript.effectiveness_rating || 0) >= star
                      ? 'text-yellow-400'
                      : 'text-gray-300 hover:text-yellow-300'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowScriptModal(false)}>
              Fermer
            </Button>
            <Button variant="outline" onClick={handleCopyScript}>
              📋 Copier
            </Button>
            <Button onClick={() => {
              handleCopyScript()
              if (currentScript && !currentScript.used) {
                handleMarkUsed(currentScript)
              }
              setShowScriptModal(false)
            }}>
              ✅ Utiliser ce script
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
