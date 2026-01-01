import { supabase } from '../lib/supabase'
import type { Lead, Script, AIConfig, AIHistoryEntry, LeadAction, ScriptGenerationContext } from '../types'
import { DEFAULT_AI_CONFIG } from '../types'

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

interface AIServiceConfig {
  apiKey: string
  model?: string
}

export interface AIAnalysisResult {
  score: number
  priority: 'cold' | 'warm' | 'hot' | 'urgent'
  reasoning: string
  conversionProbability: number
  maturityLevel: 'awareness' | 'consideration' | 'decision'
  recommendedAction: LeadAction
  recommendations: string[]
  objections: { objection: string; response: string }[]
  confidence: number
}

interface ScriptResult {
  content: string
  personalizationData: Record<string, string>
  generationContext: ScriptGenerationContext
}

// Get OpenAI API key from team settings or localStorage
async function getApiKey(teamId?: string): Promise<string | null> {
  const localKey = localStorage.getItem('openai_api_key')
  if (localKey) return localKey

  if (teamId) {
    const { data } = await supabase
      .from('team_settings')
      .select('openai_api_key')
      .eq('team_id', teamId)
      .single()

    return data?.openai_api_key || null
  }

  return null
}

// Get team AI config
export async function getTeamAIConfig(teamId: string): Promise<AIConfig> {
  try {
    const { data } = await supabase
      .from('teams')
      .select('ai_config')
      .eq('id', teamId)
      .single()

    return data?.ai_config || DEFAULT_AI_CONFIG
  } catch {
    return DEFAULT_AI_CONFIG
  }
}

// Update team AI config
export async function updateTeamAIConfig(teamId: string, config: AIConfig): Promise<boolean> {
  const { error } = await supabase
    .from('teams')
    .update({ ai_config: config })
    .eq('id', teamId)

  return !error
}

// Call OpenAI API
async function callOpenAI(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  config: AIServiceConfig
): Promise<{ content: string; tokens: number }> {
  const response = await fetch(OPENAI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'OpenAI API error')
  }

  const data = await response.json()

  return {
    content: data.choices[0]?.message?.content || '',
    tokens: data.usage?.total_tokens || 0,
  }
}

// Build lead context for AI
function buildLeadContext(lead: Lead): string {
  const parts = []

  if (lead.full_name || lead.first_name) {
    parts.push(`Nom: ${lead.full_name || `${lead.first_name} ${lead.last_name}`}`)
  }
  if (lead.company_name) parts.push(`Entreprise: ${lead.company_name}`)
  if (lead.job_title) parts.push(`Poste: ${lead.job_title}`)
  if (lead.sector) parts.push(`Secteur: ${lead.sector}`)
  if (lead.company_size) parts.push(`Taille entreprise: ${lead.company_size}`)
  if (lead.city || lead.country) parts.push(`Localisation: ${[lead.city, lead.country].filter(Boolean).join(', ')}`)
  if (lead.is_decision_maker) parts.push('Décisionnaire: Oui')
  if (lead.status) parts.push(`Statut actuel: ${lead.status}`)
  if (lead.priority) parts.push(`Priorité actuelle: ${lead.priority}`)
  if (lead.notes) parts.push(`Notes: ${lead.notes}`)
  if (lead.linkedin_url) parts.push(`LinkedIn: ${lead.linkedin_url}`)
  if (lead.website) parts.push(`Site web: ${lead.website}`)
  if (lead.email) parts.push(`Email: ${lead.email}`)
  if (lead.phone) parts.push(`Téléphone: ${lead.phone ? 'Oui' : 'Non'}`)
  if (lead.last_contacted_at) parts.push(`Dernier contact: ${lead.last_contacted_at}`)

  return parts.join('\n')
}

// Log AI analysis to database
async function logAIAnalysis(
  leadId: string,
  analysisType: 'initial_scoring' | 'rescore' | 'action_recommendation' | 'enrichment',
  inputData: Record<string, unknown>,
  outputData: Record<string, unknown>,
  reasoning: string,
  confidence: number,
  modelUsed: string,
  tokensUsed: number,
  processingTimeMs: number
): Promise<void> {
  try {
    await supabase.from('ai_analysis_log').insert({
      lead_id: leadId,
      analysis_type: analysisType,
      input_data: inputData,
      output_data: outputData,
      reasoning,
      confidence,
      model_used: modelUsed,
      tokens_used: tokensUsed,
      processing_time_ms: processingTimeMs,
    })
  } catch (error) {
    console.error('Error logging AI analysis:', error)
  }
}

// Add entry to lead's AI history
async function addToAIHistory(
  leadId: string,
  entry: AIHistoryEntry,
  currentHistory: AIHistoryEntry[] = []
): Promise<void> {
  const newHistory = [...currentHistory, entry].slice(-10) // Keep last 10 entries

  await supabase
    .from('leads')
    .update({ ai_history: newHistory })
    .eq('id', leadId)
}

// Main function: Analyze a lead with AI
export async function analyzeNewLead(
  lead: Lead,
  teamId: string,
  isRescore: boolean = false
): Promise<AIAnalysisResult> {
  const apiKey = await getApiKey(teamId)
  const startTime = Date.now()

  if (!apiKey) {
    throw new Error('Clé API OpenAI non configurée. Allez dans Paramètres > Intégrations.')
  }

  const leadContext = buildLeadContext(lead)

  const systemPrompt = `Tu es un expert en qualification de leads B2B pour une équipe commerciale française.
Analyse le lead fourni et retourne un JSON avec:
- score: nombre de 0 à 100 indiquant la qualité du lead
- priority: "cold" | "warm" | "hot" | "urgent" basé sur le score et le contexte
- reasoning: explication détaillée (2-3 phrases) de pourquoi ce score
- conversionProbability: probabilité de conversion (0-100)
- maturityLevel: "awareness" | "consideration" | "decision"
- recommendedAction: la meilleure prochaine action parmi: "call_today", "send_email", "send_whatsapp", "follow_up", "schedule_meeting", "send_proposal"
- recommendations: tableau de 3-5 recommandations d'actions commerciales
- objections: tableau de 2-4 objections probables avec leurs réponses
- confidence: ton niveau de confiance dans cette analyse (0-1)

Critères de scoring:
- Décisionnaire = +20 points
- Entreprise identifiée = +15 points
- Secteur pertinent = +10 points
- Taille entreprise moyenne/grande = +15 points
- Informations de contact complètes = +10 points
- LinkedIn présent = +5 points
- Notes qualitatives positives = +10 points

Règles de priorité:
- score >= 80 = "urgent" ou "hot"
- score >= 60 = "hot" ou "warm"
- score >= 40 = "warm"
- score < 40 = "cold"

Retourne UNIQUEMENT le JSON, sans markdown.`

  const { content, tokens } = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyse ce lead:\n\n${leadContext}` },
    ],
    { apiKey }
  )

  const processingTime = Date.now() - startTime

  let result: AIAnalysisResult
  try {
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    result = JSON.parse(cleanJson)
  } catch {
    // Return default if parsing fails
    result = {
      score: 50,
      priority: 'warm',
      reasoning: 'Analyse automatique non disponible - lead à qualifier manuellement.',
      conversionProbability: 30,
      maturityLevel: 'awareness',
      recommendedAction: 'call_today',
      recommendations: ['Contacter le lead pour qualifier', 'Identifier le besoin principal'],
      objections: [{ objection: 'Pas le bon moment', response: 'Je comprends. Quand serait le meilleur moment pour en reparler ?' }],
      confidence: 0.5,
    }
  }

  // Log the analysis
  await logAIAnalysis(
    lead.id,
    isRescore ? 'rescore' : 'initial_scoring',
    { lead: buildLeadContext(lead) },
    { ...result } as Record<string, unknown>,
    result.reasoning,
    result.confidence,
    'gpt-4o-mini',
    tokens,
    processingTime
  )

  // Add to history
  const historyEntry: AIHistoryEntry = {
    date: new Date().toISOString(),
    type: 'scoring',
    score: result.score,
    priority: result.priority,
    action: result.recommendedAction,
    reasoning: result.reasoning,
  }
  await addToAIHistory(lead.id, historyEntry, lead.ai_history || [])

  return result
}

// Apply AI results to lead based on team config
export async function applyAIResultsToLead(
  leadId: string,
  result: AIAnalysisResult,
  aiConfig: AIConfig
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  // Always apply scoring (auto_scoring is always true by design)
  if (aiConfig.auto_scoring) {
    updateData.ai_score = result.score
    updateData.priority = result.priority
    updateData.ai_analyzed = true
    updateData.ai_analysis_date = new Date().toISOString()
    updateData.ai_reasoning = result.reasoning
    updateData.conversion_probability = result.conversionProbability
    updateData.maturity_level = result.maturityLevel
    updateData.ai_recommendations = result.recommendations.join('\n')
    updateData.ai_objections = result.objections
  }

  // Store recommended action (always)
  updateData.ai_recommended_action = result.recommendedAction

  // Apply action automatically if configured
  if (aiConfig.auto_action_recommendation) {
    updateData.current_action = result.recommendedAction
    updateData.current_action_date = new Date().toISOString()
  }

  const { error } = await supabase
    .from('leads')
    .update(updateData)
    .eq('id', leadId)

  return !error
}

// Convenience function: Analyze and apply in one call
export async function analyzeAndApplyToLead(
  lead: Lead,
  teamId: string,
  isRescore: boolean = false
): Promise<AIAnalysisResult> {
  const result = await analyzeNewLead(lead, teamId, isRescore)
  const aiConfig = await getTeamAIConfig(teamId)
  await applyAIResultsToLead(lead.id, result, aiConfig)
  return result
}

// Suggest action for a lead (manual trigger)
export async function suggestAction(
  lead: Lead,
  teamId: string
): Promise<{ action: LeadAction; reason: string }> {
  const apiKey = await getApiKey(teamId)

  if (!apiKey) {
    return {
      action: 'call_today',
      reason: 'Aucune analyse IA disponible - rappeler pour qualifier',
    }
  }

  const leadContext = buildLeadContext(lead)

  const systemPrompt = `Tu es un coach commercial expert. Analyse le lead et suggère la prochaine action optimale.
Retourne un JSON avec:
- action: une des valeurs suivantes: "call_today", "send_email", "send_whatsapp", "follow_up", "schedule_meeting", "send_proposal", "waiting_response"
- reason: explication courte de pourquoi cette action (1-2 phrases)

Retourne UNIQUEMENT le JSON.`

  const { content } = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Lead:\n${leadContext}\n\nStatut: ${lead.status}\nDernier contact: ${lead.last_contacted_at || 'Jamais'}\nAction actuelle: ${lead.current_action || 'Aucune'}` },
    ],
    { apiKey }
  )

  try {
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch {
    return {
      action: 'follow_up',
      reason: 'Relancer le lead pour maintenir le contact',
    }
  }
}

// Apply suggested action to lead
export async function applySuggestedAction(
  leadId: string,
  action: LeadAction,
  reason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('leads')
    .update({
      current_action: action,
      current_action_date: new Date().toISOString(),
      current_action_note: `IA: ${reason}`,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  return !error
}

// Get recent activities for a lead (last 5)
async function getRecentActivities(leadId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('activities')
      .select('activity_type, description, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(5)

    if (!data || data.length === 0) return []

    return data.map(a => `${a.activity_type}: ${a.description || 'Pas de détails'}`)
  } catch {
    return []
  }
}

// Build personalization context for script generation
function buildScriptContext(lead: Lead, recentActivities: string[]): ScriptGenerationContext {
  const objections = lead.ai_objections?.map(o => o.objection) || []

  return {
    source: lead.source,
    campaign: lead.source_campaign || undefined,
    product_interest: lead.product_interest || undefined,
    maturity: lead.maturity_level,
    objections_addressed: objections.length > 0 ? objections : undefined,
    lead_type: lead.lead_type,
    recent_activities: recentActivities.length > 0 ? recentActivities : undefined,
  }
}

// Generate a PERSONALIZED script for a lead
export async function generateScript(
  lead: Lead,
  scriptType: 'phone_call' | 'email_intro' | 'email_followup' | 'linkedin_message',
  teamId?: string,
  additionalContext?: string
): Promise<ScriptResult> {
  const apiKey = await getApiKey(teamId)

  if (!apiKey) {
    throw new Error('Clé API OpenAI non configurée. Allez dans Paramètres > Intégrations.')
  }

  // Fetch recent activities
  const recentActivities = await getRecentActivities(lead.id)
  const generationContext = buildScriptContext(lead, recentActivities)

  const leadContext = buildLeadContext(lead)

  // Build personalization info for the prompt
  const personalizationInfo: string[] = []

  if (lead.source_campaign) {
    personalizationInfo.push(`Source: ${lead.source} via campagne "${lead.source_campaign}"`)
  } else {
    personalizationInfo.push(`Source: ${lead.source}`)
  }

  if (lead.product_interest) {
    personalizationInfo.push(`Intérêt produit: ${lead.product_interest}`)
  }

  if (lead.maturity_level) {
    const maturityLabels: Record<string, string> = {
      awareness: 'Découverte - connaît peu le sujet',
      consideration: 'Considération - compare les options',
      decision: 'Décision - prêt à acheter',
    }
    personalizationInfo.push(`Maturité: ${maturityLabels[lead.maturity_level] || lead.maturity_level}`)
  }

  if (lead.ai_objections && lead.ai_objections.length > 0) {
    personalizationInfo.push(`Objections probables: ${lead.ai_objections.map(o => o.objection).join(', ')}`)
  }

  if (recentActivities.length > 0) {
    personalizationInfo.push(`Dernières interactions:\n${recentActivities.join('\n')}`)
  }

  if (lead.lead_type) {
    personalizationInfo.push(`Type: ${lead.lead_type}`)
  }

  const personalizationBlock = personalizationInfo.length > 0
    ? `\n\n=== CONTEXTE DE PERSONNALISATION ===\n${personalizationInfo.join('\n')}\n===================================`
    : ''

  const scriptPrompts: Record<string, string> = {
    phone_call: `Génère un script d'appel téléphonique de prospection ULTRA-PERSONNALISÉ en français.

IMPORTANT: Ce script doit être spécifique à CE lead, pas générique.
${lead.source_campaign ? `Mentionne la campagne "${lead.source_campaign}" naturellement.` : ''}
${lead.product_interest ? `Centre la conversation sur "${lead.product_interest}".` : ''}
${lead.ai_objections?.length ? `Prépare des réponses aux objections identifiées.` : ''}

Structure:
1. Accroche personnalisée mentionnant COMMENT tu as eu son contact
2. Présentation rapide de la valeur liée à son intérêt
3. Question d'ouverture pour qualifier son besoin précis
4. 2-3 questions de découverte adaptées à son profil
5. Proposition de prochaine étape concrète
6. Réponses aux objections probables

Le script doit être naturel et montrer que tu CONNAIS ce lead.`,

    email_intro: `Génère un email de premier contact PERSONNALISÉ en français.

IMPORTANT: L'email doit montrer que tu sais D'OÙ vient ce lead.
${lead.source_campaign ? `Réfère-toi à la campagne "${lead.source_campaign}".` : ''}
${lead.product_interest ? `Parle de "${lead.product_interest}" spécifiquement.` : ''}

Structure:
- Objet accrocheur mentionnant son intérêt/contexte
- Accroche qui montre que tu sais comment il t'a trouvé
- 1-2 phrases sur la valeur liée à son besoin précis
- Call-to-action clair
- Signature pro

Court (max 150 mots), personnalisé, engageant.`,

    email_followup: `Génère un email de relance PERSONNALISÉ en français.

Contexte: Le lead n'a pas répondu. Il vient de ${lead.source}${lead.source_campaign ? ` (${lead.source_campaign})` : ''}.
${lead.product_interest ? `Son intérêt initial: "${lead.product_interest}".` : ''}

Structure:
- Objet de relance qui rappelle le contexte
- Rappel du premier contact avec un nouvel angle
- Nouvelle proposition de valeur adaptée
- Question ouverte ou offre concrète

Max 100 mots, montrant que tu as compris son besoin.`,

    linkedin_message: `Génère un message LinkedIn PERSONNALISÉ en français.

${lead.source === 'web_form' || lead.source_campaign ? `Ce lead a montré de l'intérêt via ${lead.source_campaign || lead.source}.` : ''}
${lead.product_interest ? `Son intérêt: "${lead.product_interest}".` : ''}

Structure:
- Message court (max 300 caractères)
- Référence à son contexte/intérêt
- Approche relationnelle, pas commerciale
- Question engageante

Ton naturel comme une vraie conversation.`,
  }

  const systemPrompt = `Tu es un expert en copywriting commercial B2B/B2C français.
${scriptPrompts[scriptType]}

${additionalContext ? `Contexte additionnel: ${additionalContext}` : ''}

Retourne un JSON avec:
- content: le script/email complet et PERSONNALISÉ
- personalizationData: objet avec les éléments personnalisés utilisés (nom, entreprise, source, campagne, intérêt, etc.)

Retourne UNIQUEMENT le JSON, sans markdown.`

  const { content } = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Génère un script PERSONNALISÉ pour ce lead:\n\n${leadContext}${personalizationBlock}` },
    ],
    { apiKey }
  )

  try {
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleanJson)
    return {
      ...result,
      generationContext,
    }
  } catch {
    return {
      content: content,
      personalizationData: {},
      generationContext,
    }
  }
}

// Save generated script to database
export async function saveScript(
  leadId: string,
  scriptType: Script['script_type'],
  content: string,
  personalizationData?: Record<string, unknown>,
  generationContext?: ScriptGenerationContext
): Promise<Script | null> {
  const { data, error } = await supabase
    .from('scripts')
    .insert({
      lead_id: leadId,
      script_type: scriptType,
      generated_content: content,
      personalization_data: personalizationData || {},
      generation_context: generationContext || {},
      generated_at: new Date().toISOString(),
      used: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error saving script:', error)
    return null
  }

  return data
}

// Get previously generated scripts for a lead
export async function getLeadScripts(leadId: string): Promise<Script[]> {
  const { data, error } = await supabase
    .from('scripts')
    .select('*')
    .eq('lead_id', leadId)
    .order('generated_at', { ascending: false })

  if (error) {
    console.error('Error fetching scripts:', error)
    return []
  }

  return data || []
}

// Mark script as used with optional rating
export async function markScriptAsUsed(
  scriptId: string,
  rating?: number
): Promise<boolean> {
  const updateData: Record<string, unknown> = {
    used: true,
    used_at: new Date().toISOString(),
  }

  if (rating && rating >= 1 && rating <= 5) {
    updateData.effectiveness_rating = rating
  }

  const { error } = await supabase
    .from('scripts')
    .update(updateData)
    .eq('id', scriptId)

  return !error
}

// Rate a script (can be done separately from marking as used)
export async function rateScript(
  scriptId: string,
  rating: number
): Promise<boolean> {
  if (rating < 1 || rating > 5) return false

  const { error } = await supabase
    .from('scripts')
    .update({ effectiveness_rating: rating })
    .eq('id', scriptId)

  return !error
}

// Auto-generate script for new lead (when auto_script_generation is enabled)
export async function autoGenerateScriptForLead(
  lead: Lead,
  teamId: string
): Promise<Script | null> {
  try {
    const result = await generateScript(lead, 'phone_call', teamId)
    const script = await saveScript(
      lead.id,
      'phone_call',
      result.content,
      result.personalizationData,
      result.generationContext
    )
    return script
  } catch (error) {
    console.error('Error auto-generating script:', error)
    return null
  }
}

// Legacy function for backwards compatibility
export async function scoreLead(lead: Lead, teamId?: string) {
  if (!teamId) {
    throw new Error('Team ID required')
  }
  return analyzeNewLead(lead, teamId)
}

// Legacy function for backwards compatibility
export async function updateLeadWithAIAnalysis(
  leadId: string,
  scoreResult: AIAnalysisResult
): Promise<boolean> {
  const { error } = await supabase
    .from('leads')
    .update({
      ai_score: scoreResult.score,
      conversion_probability: scoreResult.conversionProbability,
      maturity_level: scoreResult.maturityLevel,
      ai_recommendations: scoreResult.recommendations.join('\n'),
      ai_objections: scoreResult.objections,
      ai_analyzed: true,
      ai_reasoning: scoreResult.reasoning,
      ai_analysis_date: new Date().toISOString(),
      priority: scoreResult.priority,
      ai_recommended_action: scoreResult.recommendedAction,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  return !error
}

// Legacy function
export async function suggestNextAction(lead: Lead, teamId?: string) {
  if (!teamId) {
    return { action: 'call_back', reason: 'Team ID required' }
  }
  const result = await suggestAction(lead, teamId)
  return { ...result, script: undefined }
}

// Search query interface
export interface SearchQuery {
  query: string
  source: 'linkedin' | 'google' | 'societe.com' | 'other'
  purpose: string
}

export interface SearchHypothesis {
  hypothesis: string
  confidence: number
}

export interface SearchSuggestionsResult {
  queries: SearchQuery[]
  hypotheses: SearchHypothesis[]
}

// Generate search queries for a lead (manual feature)
export async function generateSearchQueries(
  lead: Lead,
  teamId?: string
): Promise<SearchSuggestionsResult> {
  const apiKey = await getApiKey(teamId)

  if (!apiKey) {
    throw new Error('Clé API OpenAI non configurée. Allez dans Paramètres > Intégrations.')
  }

  const leadContext = buildLeadContext(lead)

  const systemPrompt = `Tu es un expert en recherche commerciale B2B.
Tu dois générer des requêtes de recherche pour aider un commercial à trouver plus d'informations sur un lead.

IMPORTANT: Tu génères UNIQUEMENT des requêtes que le commercial peut copier-coller dans Google ou LinkedIn.
Ce n'est PAS du scraping, juste des suggestions de recherche.

Pour chaque requête, indique:
- query: la requête exacte à chercher
- source: "linkedin" (pour LinkedIn), "google" (pour Google), "societe.com" (pour infos entreprise française)
- purpose: pourquoi cette recherche est utile

Génère aussi des hypothèses basées sur les informations disponibles:
- hypothesis: ce que tu supposes sur le lead
- confidence: niveau de confiance (0 à 1)

Retourne un JSON avec:
{
  "queries": [
    { "query": "...", "source": "linkedin", "purpose": "..." },
    ...
  ],
  "hypotheses": [
    { "hypothesis": "...", "confidence": 0.8 },
    ...
  ]
}

Génère 3-5 requêtes pertinentes et 2-3 hypothèses.
Retourne UNIQUEMENT le JSON, sans markdown.`

  const { content } = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Génère des requêtes de recherche pour ce lead:\n\n${leadContext}` },
    ],
    { apiKey }
  )

  try {
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch {
    return {
      queries: [
        {
          query: `${lead.full_name || `${lead.first_name} ${lead.last_name}`} LinkedIn`,
          source: 'linkedin',
          purpose: 'Trouver le profil LinkedIn'
        },
        {
          query: `${lead.company_name || ''} entreprise`,
          source: 'google',
          purpose: 'Informations sur l\'entreprise'
        }
      ],
      hypotheses: []
    }
  }
}

// Save search results to lead
export async function saveSearchResults(
  leadId: string,
  results: SearchSuggestionsResult
): Promise<boolean> {
  const { error } = await supabase
    .from('leads')
    .update({
      ai_search_performed: true,
      ai_search_results: results,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  return !error
}

// =====================================================
// AI COACHING FOR MANAGERS
// =====================================================

export interface CoachingImprovementArea {
  area: string
  priority: 'high' | 'medium' | 'low'
  tip: string
}

export interface CoachingTipsResult {
  strengths: string[]
  improvement_areas: CoachingImprovementArea[]
  quick_wins: string[]
  summary: string
}

export interface PerformanceData {
  userId: string
  userName: string
  leadsCount: number
  contactedCount: number
  closingsCount: number
  revenue: number
  conversionRate: number
  avgResponseTimeHours: number | null
  slaMetPercentage: number | null
  slaBreached: number
  leadsBySource: { source: string; count: number; closings: number }[]
  leadsBySector: { sector: string; count: number; closings: number }[]
  monthlyLeadTarget?: number
  monthlyClosingTarget?: number
  leadProgress?: number
  closingProgress?: number
}

// Generate coaching tips for a sales rep
export async function generateCoachingTips(
  performanceData: PerformanceData,
  teamId: string
): Promise<CoachingTipsResult> {
  const apiKey = await getApiKey(teamId)

  if (!apiKey) {
    throw new Error('Cle API OpenAI non configuree. Allez dans Parametres > Integrations.')
  }

  // Build performance context for AI
  const performanceContext = buildPerformanceContext(performanceData)

  const systemPrompt = `Tu es un coach commercial expert. Analyse les performances d'un commercial et genere des conseils de coaching personnalises.

Retourne un JSON avec:
- strengths: tableau de 2-4 points forts identifies (ex: "Excellent taux de conversion sur le secteur Tech")
- improvement_areas: tableau de 2-4 axes d'amelioration avec:
  - area: le domaine a ameliorer
  - priority: "high" | "medium" | "low" selon l'urgence
  - tip: conseil actionnable et specifique
- quick_wins: tableau de 2-3 actions rapides a mettre en place immediatement
- summary: resume en 1-2 phrases du profil du commercial

Sois specifique et base-toi sur les donnees fournies. Evite les conseils generiques.
Retourne UNIQUEMENT le JSON, sans markdown.`

  const { content } = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyse les performances de ce commercial et genere des conseils de coaching:\n\n${performanceContext}` },
    ],
    { apiKey }
  )

  try {
    const cleanJson = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch {
    return {
      strengths: ['Donnees insuffisantes pour identifier les points forts'],
      improvement_areas: [
        {
          area: 'Collecte de donnees',
          priority: 'high' as const,
          tip: 'Utilise l\'application regulierement pour avoir des analyses pertinentes'
        }
      ],
      quick_wins: ['Mettre a jour le statut des leads apres chaque interaction'],
      summary: 'Pas assez de donnees pour une analyse complete.'
    }
  }
}

// Build performance context for AI analysis
function buildPerformanceContext(data: PerformanceData): string {
  const parts: string[] = []

  parts.push(`=== COMMERCIAL: ${data.userName} ===`)
  parts.push('')
  parts.push('--- METRIQUES GLOBALES ---')
  parts.push(`Leads traites: ${data.leadsCount}`)
  parts.push(`Leads contactes: ${data.contactedCount} (${data.leadsCount > 0 ? ((data.contactedCount / data.leadsCount) * 100).toFixed(1) : 0}%)`)
  parts.push(`Closings: ${data.closingsCount}`)
  parts.push(`Taux de conversion: ${data.conversionRate.toFixed(1)}%`)
  parts.push(`CA genere: ${data.revenue.toLocaleString('fr-FR')} EUR`)

  if (data.monthlyLeadTarget && data.monthlyLeadTarget > 0) {
    parts.push('')
    parts.push('--- OBJECTIFS MENSUELS ---')
    parts.push(`Objectif leads: ${data.leadsCount} / ${data.monthlyLeadTarget} (${data.leadProgress || 0}%)`)
    if (data.monthlyClosingTarget && data.monthlyClosingTarget > 0) {
      parts.push(`Objectif closings: ${data.closingsCount} / ${data.monthlyClosingTarget} (${data.closingProgress || 0}%)`)
    }
  }

  parts.push('')
  parts.push('--- REACTIVITE ---')
  if (data.avgResponseTimeHours !== null) {
    if (data.avgResponseTimeHours < 1) {
      parts.push(`Temps moyen de reponse: ${Math.round(data.avgResponseTimeHours * 60)} minutes`)
    } else if (data.avgResponseTimeHours < 24) {
      parts.push(`Temps moyen de reponse: ${data.avgResponseTimeHours.toFixed(1)} heures`)
    } else {
      parts.push(`Temps moyen de reponse: ${(data.avgResponseTimeHours / 24).toFixed(1)} jours`)
    }
  } else {
    parts.push('Temps moyen de reponse: Non mesure')
  }

  if (data.slaMetPercentage !== null) {
    parts.push(`SLA respectes: ${data.slaMetPercentage.toFixed(0)}%`)
    if (data.slaBreached > 0) {
      parts.push(`SLA depasses: ${data.slaBreached}`)
    }
  }

  if (data.leadsBySource.length > 0) {
    parts.push('')
    parts.push('--- PERFORMANCE PAR SOURCE ---')
    data.leadsBySource
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach(s => {
        const convRate = s.count > 0 ? ((s.closings / s.count) * 100).toFixed(0) : 0
        parts.push(`${s.source}: ${s.count} leads, ${s.closings} closings (${convRate}% conv.)`)
      })
  }

  if (data.leadsBySector.length > 0) {
    parts.push('')
    parts.push('--- PERFORMANCE PAR SECTEUR ---')
    data.leadsBySector
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .forEach(s => {
        const convRate = s.count > 0 ? ((s.closings / s.count) * 100).toFixed(0) : 0
        parts.push(`${s.sector}: ${s.count} leads, ${s.closings} closings (${convRate}% conv.)`)
      })
  }

  return parts.join('\n')
}

// Save coaching tips to user_performance_profiles
export async function saveCoachingTips(
  userId: string,
  tips: CoachingTipsResult
): Promise<boolean> {
  // First check if profile exists
  const { data: existingProfile } = await supabase
    .from('user_performance_profiles')
    .select('id')
    .eq('user_id', userId)
    .single()

  const coachingData = {
    coaching_strengths: tips.strengths,
    improvement_areas: tips.improvement_areas,
    coaching_quick_wins: tips.quick_wins,
    ai_coaching_tips: [tips.summary],
    coaching_generated_at: new Date().toISOString(),
  }

  if (existingProfile) {
    const { error } = await supabase
      .from('user_performance_profiles')
      .update(coachingData)
      .eq('user_id', userId)
    return !error
  } else {
    const { error } = await supabase
      .from('user_performance_profiles')
      .insert({
        user_id: userId,
        ...coachingData,
      })
    return !error
  }
}

// Get coaching tips for a user
export async function getCoachingTips(userId: string): Promise<CoachingTipsResult | null> {
  const { data, error } = await supabase
    .from('user_performance_profiles')
    .select('coaching_strengths, improvement_areas, coaching_quick_wins, ai_coaching_tips, coaching_generated_at')
    .eq('user_id', userId)
    .single()

  if (error || !data) return null

  if (!data.coaching_generated_at) return null

  return {
    strengths: data.coaching_strengths || [],
    improvement_areas: data.improvement_areas || [],
    quick_wins: data.coaching_quick_wins || [],
    summary: data.ai_coaching_tips?.[0] || '',
  }
}
