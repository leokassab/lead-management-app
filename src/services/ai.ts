import { supabase } from '../lib/supabase'
import type { Lead, Script } from '../types'

// OpenAI API configuration
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions'

interface AIConfig {
  apiKey: string
  model?: string
}

interface ScoreResult {
  score: number
  conversionProbability: number
  maturityLevel: 'awareness' | 'consideration' | 'decision'
  recommendations: string[]
  objections: { objection: string; response: string }[]
}

interface ScriptResult {
  content: string
  personalizationData: Record<string, string>
}

// Get OpenAI API key from team settings or localStorage
async function getApiKey(teamId?: string): Promise<string | null> {
  // First check localStorage for demo/testing
  const localKey = localStorage.getItem('openai_api_key')
  if (localKey) return localKey

  // Then try to get from team settings
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

// Call OpenAI API
async function callOpenAI(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
  config: AIConfig
): Promise<string> {
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
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error?.message || 'OpenAI API error')
  }

  const data = await response.json()
  return data.choices[0]?.message?.content || ''
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
  if (lead.priority) parts.push(`Priorité: ${lead.priority}`)
  if (lead.notes) parts.push(`Notes: ${lead.notes}`)
  if (lead.linkedin_url) parts.push(`LinkedIn: ${lead.linkedin_url}`)
  if (lead.website) parts.push(`Site web: ${lead.website}`)

  return parts.join('\n')
}

// Score a lead using AI
export async function scoreLead(lead: Lead, teamId?: string): Promise<ScoreResult> {
  const apiKey = await getApiKey(teamId)

  if (!apiKey) {
    throw new Error('Clé API OpenAI non configurée. Allez dans Paramètres > Intégrations.')
  }

  const leadContext = buildLeadContext(lead)

  const systemPrompt = `Tu es un expert en qualification de leads B2B pour une équipe commerciale française.
Analyse le lead fourni et retourne un JSON avec:
- score: nombre de 0 à 100 indiquant la qualité du lead
- conversionProbability: probabilité de conversion (0-100)
- maturityLevel: "awareness" | "consideration" | "decision"
- recommendations: tableau de 3-5 recommandations d'actions commerciales
- objections: tableau de 2-4 objections probables avec leurs réponses

Critères de scoring:
- Décisionnaire = +20 points
- Entreprise identifiée = +15 points
- Secteur pertinent = +10 points
- Taille entreprise moyenne/grande = +15 points
- Informations de contact complètes = +10 points
- LinkedIn présent = +5 points
- Notes qualitatives positives = +10 points

Retourne UNIQUEMENT le JSON, sans markdown.`

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Analyse ce lead:\n\n${leadContext}` },
    ],
    { apiKey }
  )

  try {
    // Clean potential markdown formatting
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch {
    // Return default if parsing fails
    return {
      score: 50,
      conversionProbability: 30,
      maturityLevel: 'awareness',
      recommendations: ['Contacter le lead pour qualifier', 'Identifier le besoin principal'],
      objections: [{ objection: 'Pas le bon moment', response: 'Je comprends. Quand serait le meilleur moment pour en reparler ?' }],
    }
  }
}

// Generate a script for a lead
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

  const leadContext = buildLeadContext(lead)

  const scriptPrompts: Record<string, string> = {
    phone_call: `Génère un script d'appel téléphonique de prospection en français.
Structure:
1. Accroche personnalisée (mentionner l'entreprise/poste)
2. Présentation rapide de la valeur
3. Question d'ouverture pour qualifier
4. 2-3 questions de découverte
5. Proposition de prochaine étape
6. Gestion des objections communes

Le script doit être naturel, pas robotique. Environ 200 mots.`,

    email_intro: `Génère un email de premier contact en français.
Structure:
- Objet accrocheur et personnalisé
- Accroche qui montre que tu connais leur contexte
- 1-2 phrases sur la valeur apportée
- Call-to-action clair (proposition de rdv)
- Signature professionnelle

L'email doit être court (max 150 mots), personnalisé et engageant.`,

    email_followup: `Génère un email de relance en français.
Contexte: Le lead n'a pas répondu au premier email.
Structure:
- Objet de relance subtil
- Rappel bref du premier contact
- Nouvelle approche/angle de valeur
- Question ouverte ou proposition concrète
- Ton amical mais professionnel

Max 100 mots, direct et efficace.`,

    linkedin_message: `Génère un message LinkedIn de prise de contact en français.
Structure:
- Message court (max 300 caractères)
- Personnalisation basée sur le profil
- Pas de pitch direct, approche relationnelle
- Question ou remarque engageante

Ton: professionnel mais décontracté, comme une vraie conversation.`,
  }

  const systemPrompt = `Tu es un expert en copywriting commercial B2B français.
${scriptPrompts[scriptType]}

${additionalContext ? `Contexte additionnel: ${additionalContext}` : ''}

Retourne un JSON avec:
- content: le script/email complet
- personalizationData: objet avec les éléments personnalisés utilisés (nom, entreprise, etc.)

Retourne UNIQUEMENT le JSON, sans markdown.`

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Génère pour ce lead:\n\n${leadContext}` },
    ],
    { apiKey }
  )

  try {
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch {
    return {
      content: response,
      personalizationData: {},
    }
  }
}

// Save generated script to database
export async function saveScript(
  leadId: string,
  scriptType: Script['script_type'],
  content: string,
  personalizationData?: Record<string, unknown>
): Promise<Script | null> {
  const { data, error } = await supabase
    .from('scripts')
    .insert({
      lead_id: leadId,
      script_type: scriptType,
      generated_content: content,
      personalization_data: personalizationData || {},
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

// Update lead with AI analysis
export async function updateLeadWithAIAnalysis(
  leadId: string,
  scoreResult: ScoreResult
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)

  return !error
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

// Mark script as used
export async function markScriptAsUsed(scriptId: string): Promise<boolean> {
  const { error } = await supabase
    .from('scripts')
    .update({ used: true })
    .eq('id', scriptId)

  return !error
}

// Analyze lead and suggest next action
export async function suggestNextAction(
  lead: Lead,
  teamId?: string
): Promise<{ action: string; reason: string; script?: string }> {
  const apiKey = await getApiKey(teamId)

  if (!apiKey) {
    // Return default suggestion without AI
    return {
      action: 'call_back',
      reason: 'Aucune analyse IA disponible - rappeler pour qualifier',
    }
  }

  const leadContext = buildLeadContext(lead)

  const systemPrompt = `Tu es un coach commercial expert. Analyse le lead et suggère la prochaine action optimale.
Retourne un JSON avec:
- action: "call_back" | "send_proposal" | "follow_up" | "meeting"
- reason: explication courte de pourquoi cette action
- script: phrase d'accroche suggérée pour cette action (optionnel)

Retourne UNIQUEMENT le JSON.`

  const response = await callOpenAI(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Lead:\n${leadContext}\n\nStatut: ${lead.status}\nDernier contact: ${lead.last_contacted_at || 'Jamais'}` },
    ],
    { apiKey }
  )

  try {
    const cleanJson = response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleanJson)
  } catch {
    return {
      action: 'follow_up',
      reason: 'Relancer le lead pour maintenir le contact',
    }
  }
}
