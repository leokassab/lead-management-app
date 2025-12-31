import { supabase } from '../lib/supabase'
import type { Lead } from '../types'

// Email types
export type EmailType = 'professional' | 'personal' | 'disposable' | 'unknown'

// Phone types
export type PhoneType = 'mobile' | 'landline' | 'voip' | 'unknown'

// Validation result interfaces
export interface EmailValidationResult {
  valid: boolean
  type: EmailType
  reason?: string
}

export interface PhoneValidationResult {
  valid: boolean
  type: PhoneType
  formatted?: string
  reason?: string
}

export interface EnrichmentResult {
  email_validated?: boolean
  email_type?: EmailType
  email_validation_date?: string
  phone_validated?: boolean
  phone_type?: PhoneType
  phone_validation_date?: string
  enriched_at: string
}

// Known personal email domains
const PERSONAL_EMAIL_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.fr',
  'outlook.com',
  'outlook.fr',
  'live.com',
  'live.fr',
  'msn.com',
  'yahoo.com',
  'yahoo.fr',
  'aol.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'mail.com',
  'gmx.com',
  'gmx.fr',
  'orange.fr',
  'wanadoo.fr',
  'free.fr',
  'sfr.fr',
  'laposte.net',
  'bbox.fr',
  'neuf.fr',
  'numericable.fr',
]

// Known disposable email domains
const DISPOSABLE_EMAIL_DOMAINS = [
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'mailinator.com',
  '10minutemail.com',
  'throwaway.email',
  'fakeinbox.com',
  'trashmail.com',
  'yopmail.com',
  'yopmail.fr',
  'jetable.org',
  'maildrop.cc',
  'getnada.com',
  'mohmal.com',
  'tempail.com',
  'dispostable.com',
  'sharklasers.com',
  'spam4.me',
  'grr.la',
  'guerrillamail.info',
  'spamgourmet.com',
  'mailnesia.com',
  'mintemail.com',
]

/**
 * Validate an email address and detect its type
 */
export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, type: 'unknown', reason: 'Email manquant' }
  }

  const trimmedEmail = email.trim().toLowerCase()

  // Basic format validation with regex
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  if (!emailRegex.test(trimmedEmail)) {
    return { valid: false, type: 'unknown', reason: 'Format email invalide' }
  }

  // Extract domain
  const domain = trimmedEmail.split('@')[1]

  if (!domain) {
    return { valid: false, type: 'unknown', reason: 'Domaine manquant' }
  }

  // Check if disposable
  if (DISPOSABLE_EMAIL_DOMAINS.includes(domain)) {
    return { valid: true, type: 'disposable', reason: 'Email jetable détecté' }
  }

  // Check if personal
  if (PERSONAL_EMAIL_DOMAINS.includes(domain)) {
    return { valid: true, type: 'personal', reason: 'Email personnel' }
  }

  // Default to professional (company domain)
  return { valid: true, type: 'professional', reason: 'Email professionnel' }
}

/**
 * Validate a phone number and detect its type
 */
export function validatePhone(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, type: 'unknown', reason: 'Téléphone manquant' }
  }

  // Clean the phone number - remove spaces, dots, dashes, parentheses
  let cleaned = phone.replace(/[\s.\-()]/g, '')

  // Handle French numbers
  // +33 format
  if (cleaned.startsWith('+33')) {
    cleaned = '0' + cleaned.slice(3)
  }
  // 0033 format
  if (cleaned.startsWith('0033')) {
    cleaned = '0' + cleaned.slice(4)
  }

  // Check if it's a valid French number format (10 digits starting with 0)
  const frenchRegex = /^0[1-9][0-9]{8}$/
  if (!frenchRegex.test(cleaned)) {
    // Check for international format (at least 8 digits)
    const internationalRegex = /^\+?[0-9]{8,15}$/
    if (!internationalRegex.test(phone.replace(/[\s.\-()]/g, ''))) {
      return { valid: false, type: 'unknown', reason: 'Format téléphone invalide' }
    }
    // International number - can't determine type
    return { valid: true, type: 'unknown', formatted: phone, reason: 'Numéro international' }
  }

  // Detect French phone type by prefix
  const prefix = cleaned.substring(0, 2)

  // Mobile: 06, 07
  if (prefix === '06' || prefix === '07') {
    return {
      valid: true,
      type: 'mobile',
      formatted: cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5'),
      reason: 'Mobile français'
    }
  }

  // Landline: 01, 02, 03, 04, 05
  if (['01', '02', '03', '04', '05'].includes(prefix)) {
    return {
      valid: true,
      type: 'landline',
      formatted: cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5'),
      reason: 'Fixe français'
    }
  }

  // Special numbers: 08, 09
  if (prefix === '08') {
    return {
      valid: true,
      type: 'voip', // Often used for services
      formatted: cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5'),
      reason: 'Numéro spécial/service'
    }
  }

  if (prefix === '09') {
    return {
      valid: true,
      type: 'voip', // Box internet / VoIP
      formatted: cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5'),
      reason: 'VoIP / Box internet'
    }
  }

  return { valid: true, type: 'unknown', formatted: cleaned, reason: 'Type non déterminé' }
}

/**
 * Enrich a lead with email and phone validation
 */
export function enrichLead(lead: Lead): EnrichmentResult {
  const result: EnrichmentResult = {
    enriched_at: new Date().toISOString(),
  }

  // Validate email if present
  if (lead.email) {
    const emailResult = validateEmail(lead.email)
    result.email_validated = emailResult.valid
    result.email_type = emailResult.type
    result.email_validation_date = new Date().toISOString()
  }

  // Validate phone if present
  if (lead.phone) {
    const phoneResult = validatePhone(lead.phone)
    result.phone_validated = phoneResult.valid
    result.phone_type = phoneResult.type
    result.phone_validation_date = new Date().toISOString()
  }

  return result
}

/**
 * Enrich a lead and save to database
 */
export async function enrichAndSaveLead(leadId: string, lead: Lead): Promise<EnrichmentResult | null> {
  try {
    const enrichmentData = enrichLead(lead)

    const { error } = await supabase
      .from('leads')
      .update({
        ...enrichmentData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)

    if (error) {
      console.error('Error saving enrichment:', error)
      return null
    }

    return enrichmentData
  } catch (error) {
    console.error('Error enriching lead:', error)
    return null
  }
}

/**
 * Get enrichment status summary for display
 */
export function getEnrichmentSummary(lead: Lead): {
  isEnriched: boolean
  emailStatus: 'valid' | 'invalid' | 'not_checked'
  phoneStatus: 'valid' | 'invalid' | 'not_checked'
} {
  const isEnriched = !!lead.enriched_at

  let emailStatus: 'valid' | 'invalid' | 'not_checked' = 'not_checked'
  if (lead.email_validated === true) emailStatus = 'valid'
  else if (lead.email_validated === false) emailStatus = 'invalid'

  let phoneStatus: 'valid' | 'invalid' | 'not_checked' = 'not_checked'
  if (lead.phone_validated === true) phoneStatus = 'valid'
  else if (lead.phone_validated === false) phoneStatus = 'invalid'

  return { isEnriched, emailStatus, phoneStatus }
}
