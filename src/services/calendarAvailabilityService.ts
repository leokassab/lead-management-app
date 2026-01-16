import { supabase } from '../lib/supabase'

interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  token_type: string
}

interface OutlookTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  token_type: string
}

interface CalendarEvent {
  start: string
  end: string
  summary?: string
}

interface AvailabilityResult {
  available: boolean
  busyUntil?: string
  calendarType?: 'google' | 'outlook'
  error?: string
}

// Google OAuth config
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''

// Microsoft OAuth config
const MS_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || ''
const MS_CLIENT_SECRET = import.meta.env.VITE_MICROSOFT_CLIENT_SECRET || ''

/**
 * Refresh Google access token if expired
 */
async function refreshGoogleToken(userId: string, tokens: GoogleTokens): Promise<string | null> {
  try {
    // Check if token is still valid (with 5 min buffer)
    if (tokens.expires_at > Date.now() + 300000) {
      return tokens.access_token
    }

    // Refresh the token
    if (!tokens.refresh_token) {
      return null
    }

    const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    })

    if (!refreshResponse.ok) {
      return null
    }

    const newTokens = await refreshResponse.json()
    const expiresAt = Date.now() + (newTokens.expires_in * 1000)

    const updatedTokenData: GoogleTokens = {
      access_token: newTokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      token_type: newTokens.token_type,
    }

    // Update tokens in database
    await supabase
      .from('users')
      .update({ google_calendar_token: updatedTokenData })
      .eq('id', userId)

    return newTokens.access_token
  } catch (error) {
    console.error('Error refreshing Google token:', error)
    return null
  }
}

/**
 * Refresh Outlook access token if expired
 */
async function refreshOutlookToken(userId: string, tokens: OutlookTokens): Promise<string | null> {
  try {
    // Check if token is still valid (with 5 min buffer)
    if (tokens.expires_at > Date.now() + 300000) {
      return tokens.access_token
    }

    // Refresh the token
    if (!tokens.refresh_token) {
      return null
    }

    const refreshResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
        scope: 'openid profile email offline_access Calendars.ReadWrite',
      }),
    })

    if (!refreshResponse.ok) {
      return null
    }

    const newTokens = await refreshResponse.json()
    const expiresAt = Date.now() + (newTokens.expires_in * 1000)

    const updatedTokenData: OutlookTokens = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token,
      expires_at: expiresAt,
      token_type: newTokens.token_type,
    }

    // Update tokens in database
    await supabase
      .from('users')
      .update({ outlook_token: updatedTokenData })
      .eq('id', userId)

    return newTokens.access_token
  } catch (error) {
    console.error('Error refreshing Outlook token:', error)
    return null
  }
}

/**
 * Check Google Calendar availability for the next X hours
 */
async function checkGoogleAvailability(
  userId: string,
  tokens: GoogleTokens,
  hoursAhead: number = 2
): Promise<AvailabilityResult> {
  try {
    const accessToken = await refreshGoogleToken(userId, tokens)
    if (!accessToken) {
      return { available: true, error: 'Could not refresh Google token' }
    }

    const now = new Date()
    const timeMin = now.toISOString()
    const timeMax = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000).toISOString()

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    url.searchParams.set('timeMin', timeMin)
    url.searchParams.set('timeMax', timeMax)
    url.searchParams.set('singleEvents', 'true')
    url.searchParams.set('orderBy', 'startTime')

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return { available: true, error: 'Failed to fetch Google calendar events' }
    }

    const data = await response.json()
    const events: CalendarEvent[] = (data.items || [])
      .filter((event: { status?: string }) => event.status !== 'cancelled')
      .map((event: { start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; summary?: string }) => ({
        start: event.start?.dateTime || event.start?.date || '',
        end: event.end?.dateTime || event.end?.date || '',
        summary: event.summary,
      }))

    // Check if any event is happening now
    const currentlyBusy = events.find(event => {
      const start = new Date(event.start)
      const end = new Date(event.end)
      return now >= start && now < end
    })

    if (currentlyBusy) {
      return {
        available: false,
        busyUntil: currentlyBusy.end,
        calendarType: 'google',
      }
    }

    return { available: true, calendarType: 'google' }
  } catch (error) {
    console.error('Error checking Google availability:', error)
    return { available: true, error: 'Error checking Google calendar' }
  }
}

/**
 * Check Outlook Calendar availability for the next X hours
 */
async function checkOutlookAvailability(
  userId: string,
  tokens: OutlookTokens,
  hoursAhead: number = 2
): Promise<AvailabilityResult> {
  try {
    const accessToken = await refreshOutlookToken(userId, tokens)
    if (!accessToken) {
      return { available: true, error: 'Could not refresh Outlook token' }
    }

    const now = new Date()
    const startDateTime = now.toISOString()
    const endDateTime = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000).toISOString()

    const url = new URL('https://graph.microsoft.com/v1.0/me/calendarview')
    url.searchParams.set('startDateTime', startDateTime)
    url.searchParams.set('endDateTime', endDateTime)
    url.searchParams.set('$select', 'subject,start,end,showAs')
    url.searchParams.set('$orderby', 'start/dateTime')

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      return { available: true, error: 'Failed to fetch Outlook calendar events' }
    }

    const data = await response.json()
    const events: CalendarEvent[] = (data.value || [])
      .filter((event: { showAs?: string }) => event.showAs === 'busy' || event.showAs === 'tentative')
      .map((event: { start?: { dateTime?: string }; end?: { dateTime?: string }; subject?: string }) => ({
        start: event.start?.dateTime || '',
        end: event.end?.dateTime || '',
        summary: event.subject,
      }))

    // Check if any event is happening now
    const currentlyBusy = events.find(event => {
      const start = new Date(event.start)
      const end = new Date(event.end)
      return now >= start && now < end
    })

    if (currentlyBusy) {
      return {
        available: false,
        busyUntil: currentlyBusy.end,
        calendarType: 'outlook',
      }
    }

    return { available: true, calendarType: 'outlook' }
  } catch (error) {
    console.error('Error checking Outlook availability:', error)
    return { available: true, error: 'Error checking Outlook calendar' }
  }
}

/**
 * Check if a user is available based on their connected calendars
 * Returns true if available, false if busy
 */
export async function checkUserCalendarAvailability(
  userId: string,
  hoursAhead: number = 2
): Promise<AvailabilityResult> {
  try {
    // Get user's calendar tokens
    const { data: user, error } = await supabase
      .from('users')
      .select('google_calendar_connected, google_calendar_token, outlook_connected, outlook_token')
      .eq('id', userId)
      .single()

    if (error || !user) {
      // If we can't get user data, assume available
      return { available: true, error: 'Could not fetch user data' }
    }

    // Check Google Calendar if connected
    if (user.google_calendar_connected && user.google_calendar_token) {
      const googleResult = await checkGoogleAvailability(
        userId,
        user.google_calendar_token as GoogleTokens,
        hoursAhead
      )
      if (!googleResult.available) {
        return googleResult
      }
    }

    // Check Outlook Calendar if connected
    if (user.outlook_connected && user.outlook_token) {
      const outlookResult = await checkOutlookAvailability(
        userId,
        user.outlook_token as OutlookTokens,
        hoursAhead
      )
      if (!outlookResult.available) {
        return outlookResult
      }
    }

    // If no calendar connected or all calendars show available
    return { available: true }
  } catch (error) {
    console.error('Error checking user calendar availability:', error)
    return { available: true, error: 'Error checking calendar availability' }
  }
}

/**
 * Check if a user has any calendar connected
 */
export async function userHasCalendarConnected(userId: string): Promise<boolean> {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('google_calendar_connected, outlook_connected')
      .eq('id', userId)
      .single()

    if (error || !user) {
      return false
    }

    return Boolean(user.google_calendar_connected || user.outlook_connected)
  } catch {
    return false
  }
}

/**
 * Get team's calendar assignment settings
 */
export async function getTeamCalendarSettings(teamId: string): Promise<{
  checkCalendar: boolean
  fallbackStrategy: 'next_available' | 'round_robin' | 'manual'
}> {
  try {
    const { data: team, error } = await supabase
      .from('teams')
      .select('assignment_check_calendar, assignment_fallback_strategy')
      .eq('id', teamId)
      .single()

    if (error || !team) {
      return { checkCalendar: false, fallbackStrategy: 'round_robin' }
    }

    return {
      checkCalendar: team.assignment_check_calendar || false,
      fallbackStrategy: team.assignment_fallback_strategy || 'round_robin',
    }
  } catch {
    return { checkCalendar: false, fallbackStrategy: 'round_robin' }
  }
}

/**
 * Update team's calendar assignment settings
 */
export async function updateTeamCalendarSettings(
  teamId: string,
  settings: {
    checkCalendar?: boolean
    fallbackStrategy?: 'next_available' | 'round_robin' | 'manual'
  }
): Promise<boolean> {
  try {
    const updateData: Record<string, unknown> = {}
    if (settings.checkCalendar !== undefined) {
      updateData.assignment_check_calendar = settings.checkCalendar
    }
    if (settings.fallbackStrategy !== undefined) {
      updateData.assignment_fallback_strategy = settings.fallbackStrategy
    }

    const { error } = await supabase
      .from('teams')
      .update(updateData)
      .eq('id', teamId)

    return !error
  } catch {
    return false
  }
}
