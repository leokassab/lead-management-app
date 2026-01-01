import { useState, useCallback } from 'react'
import { useAuthStore } from '../stores/authStore'
import {
  analyzeAndApplyToLead,
  suggestAction,
  applySuggestedAction,
  getTeamAIConfig,
  type AIAnalysisResult,
} from '../services/ai'
import type { Lead, AIConfig, LeadAction } from '../types'
import { DEFAULT_AI_CONFIG } from '../types'

export function useAIAnalysis() {
  const { profile } = useAuthStore()
  const [analyzing, setAnalyzing] = useState(false)
  const [suggesting, setSuggesting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiConfig, setAIConfig] = useState<AIConfig>(DEFAULT_AI_CONFIG)

  // Fetch AI config for team
  const fetchAIConfig = useCallback(async () => {
    if (!profile?.team_id) return DEFAULT_AI_CONFIG

    try {
      const config = await getTeamAIConfig(profile.team_id)
      setAIConfig(config)
      return config
    } catch {
      return DEFAULT_AI_CONFIG
    }
  }, [profile?.team_id])

  // Analyze a lead with AI
  const analyzeLead = useCallback(async (
    lead: Lead,
    isRescore: boolean = false
  ): Promise<AIAnalysisResult | null> => {
    if (!profile?.team_id) {
      setError('Team ID not found')
      return null
    }

    setAnalyzing(true)
    setError(null)

    try {
      const result = await analyzeAndApplyToLead(lead, profile.team_id, isRescore)
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de l\'analyse'
      setError(message)
      return null
    } finally {
      setAnalyzing(false)
    }
  }, [profile?.team_id])

  // Suggest next action for a lead
  const suggestNextAction = useCallback(async (
    lead: Lead
  ): Promise<{ action: LeadAction; reason: string } | null> => {
    if (!profile?.team_id) {
      setError('Team ID not found')
      return null
    }

    setSuggesting(true)
    setError(null)

    try {
      const suggestion = await suggestAction(lead, profile.team_id)
      return suggestion
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la suggestion'
      setError(message)
      return null
    } finally {
      setSuggesting(false)
    }
  }, [profile?.team_id])

  // Apply suggested action to lead
  const applyAction = useCallback(async (
    leadId: string,
    action: LeadAction,
    reason: string
  ): Promise<boolean> => {
    try {
      return await applySuggestedAction(leadId, action, reason)
    } catch {
      return false
    }
  }, [])

  return {
    analyzing,
    suggesting,
    error,
    aiConfig,
    analyzeLead,
    suggestNextAction,
    applyAction,
    fetchAIConfig,
    clearError: () => setError(null),
  }
}

// Hook to trigger auto-scoring on lead creation
export function useAutoScoring() {
  const { profile } = useAuthStore()

  const triggerAutoScoring = useCallback(async (lead: Lead) => {
    if (!profile?.team_id) return

    try {
      const aiConfig = await getTeamAIConfig(profile.team_id)

      // Auto scoring is always enabled
      if (aiConfig.auto_scoring) {
        // Don't await - let it run in background
        analyzeAndApplyToLead(lead, profile.team_id, false).catch(console.error)
      }
    } catch (error) {
      console.error('Error triggering auto-scoring:', error)
    }
  }, [profile])

  return { triggerAutoScoring }
}
