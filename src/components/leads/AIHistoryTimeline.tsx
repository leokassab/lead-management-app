import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatDate } from '../../utils/formatters'

interface AIAnalysisLogEntry {
  id: string
  lead_id: string
  analysis_type: 'initial_scoring' | 'rescore' | 'action_recommendation' | 'enrichment'
  input_data: Record<string, unknown>
  output_data: {
    score?: number
    conversion_probability?: number
    maturity_level?: string
    recommended_action?: string
    [key: string]: unknown
  }
  reasoning: string | null
  confidence: number | null
  model_used: string
  tokens_used: number | null
  processing_time_ms: number | null
  created_at: string
}

interface AIHistoryTimelineProps {
  leadId: string
}

const ANALYSIS_TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  initial_scoring: { label: 'Score initial', icon: '🎯', color: 'bg-green-100 text-green-800' },
  rescore: { label: 'Recalcul du score', icon: '🔄', color: 'bg-blue-100 text-blue-800' },
  action_recommendation: { label: 'Recommandation action', icon: '💡', color: 'bg-purple-100 text-purple-800' },
  enrichment: { label: 'Enrichissement', icon: '✨', color: 'bg-yellow-100 text-yellow-800' },
}

export default function AIHistoryTimeline({ leadId }: AIHistoryTimelineProps) {
  const [entries, setEntries] = useState<AIAnalysisLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true)
      setError(null)

      try {
        const { data, error: fetchError } = await supabase
          .from('ai_analysis_log')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError

        setEntries(data || [])
      } catch (err) {
        console.error('Error fetching AI history:', err)
        setError('Erreur lors du chargement de l\'historique')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [leadId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        <span className="ml-2 text-sm text-gray-500">Chargement de l'historique...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
        {error}
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500 text-sm">
        Aucune analyse IA enregistrée pour ce lead
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>

      <div className="space-y-4">
        {entries.map((entry, index) => {
          const typeConfig = ANALYSIS_TYPE_LABELS[entry.analysis_type] || {
            label: entry.analysis_type,
            icon: '📊',
            color: 'bg-gray-100 text-gray-800'
          }
          const score = entry.output_data?.score

          return (
            <div key={entry.id} className="relative pl-10">
              {/* Timeline dot */}
              <div className={`absolute left-2 w-5 h-5 rounded-full border-2 border-white shadow flex items-center justify-center text-xs ${
                index === 0 ? 'bg-indigo-500' : 'bg-gray-300'
              }`}>
                {index === 0 && <span className="text-white text-[10px]">●</span>}
              </div>

              <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig.color}`}>
                      {typeConfig.icon} {typeConfig.label}
                    </span>
                    {score !== undefined && (
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                        score >= 80 ? 'bg-green-100 text-green-800' :
                        score >= 60 ? 'bg-blue-100 text-blue-800' :
                        score >= 40 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        Score: {score}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {formatDate(entry.created_at)}
                  </span>
                </div>

                {/* Reasoning */}
                {entry.reasoning && (
                  <p className="text-sm text-gray-700 mt-2">
                    {entry.reasoning}
                  </p>
                )}

                {/* Additional details */}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  {entry.confidence && (
                    <span>Confiance: {Math.round(entry.confidence * 100)}%</span>
                  )}
                  {entry.model_used && (
                    <span>Modèle: {entry.model_used}</span>
                  )}
                  {entry.processing_time_ms && (
                    <span>Temps: {entry.processing_time_ms}ms</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
