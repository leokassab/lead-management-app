import { supabase } from '../lib/supabase'
import type { Meeting } from '../types/meetings'

// Google OAuth configuration
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || ''
const REDIRECT_URI = `${window.location.origin}/settings?tab=integrations`

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ')

interface GoogleTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  token_type: string
}

interface GoogleCalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees?: { email: string }[]
  conferenceData?: {
    createRequest?: {
      requestId: string
      conferenceSolutionKey: { type: string }
    }
  }
  reminders?: {
    useDefault: boolean
    overrides?: { method: string; minutes: number }[]
  }
}

// Initialize Google OAuth flow
export function initGoogleAuth(): void {
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')

  authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('access_type', 'offline')
  authUrl.searchParams.set('prompt', 'consent')
  authUrl.searchParams.set('state', crypto.randomUUID())

  window.location.href = authUrl.toString()
}

// Handle OAuth callback - exchange code for tokens
export async function handleGoogleCallback(
  code: string,
  userId: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      throw new Error(errorData.error_description || 'Failed to exchange code')
    }

    const tokens = await tokenResponse.json()

    // Calculate expiration timestamp
    const expiresAt = Date.now() + (tokens.expires_in * 1000)

    const tokenData: GoogleTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      token_type: tokens.token_type,
    }

    // Get user email from Google
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    let googleEmail = ''
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json()
      googleEmail = userInfo.email
    }

    // Save tokens to user profile
    const { error } = await supabase
      .from('users')
      .update({
        google_calendar_connected: true,
        google_calendar_token: tokenData,
        google_calendar_email: googleEmail,
      })
      .eq('id', userId)

    if (error) throw error

    return { success: true, email: googleEmail }
  } catch (error) {
    console.error('Error handling Google callback:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

// Refresh access token if expired
async function refreshTokenIfNeeded(userId: string): Promise<string | null> {
  try {
    // Get current tokens
    const { data: user, error } = await supabase
      .from('users')
      .select('google_calendar_token')
      .eq('id', userId)
      .single()

    if (error || !user?.google_calendar_token) {
      return null
    }

    const tokens = user.google_calendar_token as GoogleTokens

    // Check if token is still valid (with 5 min buffer)
    if (tokens.expires_at > Date.now() + 300000) {
      return tokens.access_token
    }

    // Refresh the token
    if (!tokens.refresh_token) {
      throw new Error('No refresh token available')
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
      throw new Error('Failed to refresh token')
    }

    const newTokens = await refreshResponse.json()
    const expiresAt = Date.now() + (newTokens.expires_in * 1000)

    const updatedTokenData: GoogleTokens = {
      access_token: newTokens.access_token,
      refresh_token: tokens.refresh_token, // Keep the original refresh token
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
    console.error('Error refreshing token:', error)
    return null
  }
}

// Create a Google Calendar event
export async function createGoogleEvent(
  meeting: Meeting,
  userId: string,
  leadEmail?: string,
  createGoogleMeet: boolean = false
): Promise<{ eventId?: string; meetLink?: string; error?: string }> {
  try {
    const accessToken = await refreshTokenIfNeeded(userId)
    if (!accessToken) {
      return { error: 'Not authenticated with Google' }
    }

    const endTime = new Date(new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60000)

    const event: GoogleCalendarEvent = {
      summary: meeting.title,
      description: meeting.description || `RDV avec lead - ${meeting.title}`,
      start: {
        dateTime: meeting.scheduled_at,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'email', minutes: 60 },
        ],
      },
    }

    // Add attendee if lead has email
    if (leadEmail) {
      event.attendees = [{ email: leadEmail }]
    }

    // Request Google Meet link if video call
    if (createGoogleMeet || meeting.type === 'video') {
      event.conferenceData = {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events')
    if (createGoogleMeet || meeting.type === 'video') {
      url.searchParams.set('conferenceDataVersion', '1')
    }

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to create event')
    }

    const createdEvent = await response.json()

    // Update meeting with Google event ID and meet link
    const updateData: Record<string, unknown> = {
      google_event_id: createdEvent.id,
      google_calendar_synced: true,
    }

    if (createdEvent.conferenceData?.entryPoints) {
      const videoEntry = createdEvent.conferenceData.entryPoints.find(
        (e: { entryPointType: string }) => e.entryPointType === 'video'
      )
      if (videoEntry) {
        updateData.google_meet_link = videoEntry.uri
        updateData.location = videoEntry.uri // Also set as location
      }
    }

    await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', meeting.id)

    return {
      eventId: createdEvent.id,
      meetLink: updateData.google_meet_link as string | undefined
    }
  } catch (error) {
    console.error('Error creating Google event:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Update a Google Calendar event
export async function updateGoogleEvent(
  meeting: Meeting,
  userId: string,
  leadEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!meeting.google_event_id) {
      return { success: false, error: 'No Google event ID' }
    }

    const accessToken = await refreshTokenIfNeeded(userId)
    if (!accessToken) {
      return { success: false, error: 'Not authenticated with Google' }
    }

    const endTime = new Date(new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60000)

    const event: GoogleCalendarEvent = {
      summary: meeting.title,
      description: meeting.description || `RDV avec lead - ${meeting.title}`,
      start: {
        dateTime: meeting.scheduled_at,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    }

    if (leadEmail) {
      event.attendees = [{ email: leadEmail }]
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${meeting.google_event_id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to update event')
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating Google event:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Delete a Google Calendar event
export async function deleteGoogleEvent(
  eventId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await refreshTokenIfNeeded(userId)
    if (!accessToken) {
      return { success: false, error: 'Not authenticated with Google' }
    }

    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    // 204 No Content or 410 Gone (already deleted) are both success
    if (!response.ok && response.status !== 204 && response.status !== 410) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to delete event')
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting Google event:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Disconnect Google Calendar
export async function disconnectGoogleCalendar(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        google_calendar_connected: false,
        google_calendar_token: null,
        google_calendar_email: null,
      })
      .eq('id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error)
    return false
  }
}

// Check if Google Calendar is configured
export function isGoogleCalendarConfigured(): boolean {
  return Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET)
}

// Check user's Google Calendar connection status
export async function getGoogleCalendarStatus(userId: string): Promise<{
  connected: boolean
  email?: string
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('google_calendar_connected, google_calendar_email')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return { connected: false }
    }

    return {
      connected: data.google_calendar_connected || false,
      email: data.google_calendar_email,
    }
  } catch {
    return { connected: false }
  }
}
