import { supabase } from '../lib/supabase'
import type { Meeting } from '../types/meetings'

// Microsoft OAuth configuration
const MS_CLIENT_ID = import.meta.env.VITE_MICROSOFT_CLIENT_ID || ''
const MS_CLIENT_SECRET = import.meta.env.VITE_MICROSOFT_CLIENT_SECRET || ''
const REDIRECT_URI = `${window.location.origin}/settings?tab=integrations`

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'Calendars.ReadWrite',
  'OnlineMeetings.ReadWrite',
].join(' ')

interface OutlookTokens {
  access_token: string
  refresh_token?: string
  expires_at: number
  token_type: string
}

interface OutlookCalendarEvent {
  id?: string
  subject: string
  body?: {
    contentType: 'text' | 'html'
    content: string
  }
  start: {
    dateTime: string
    timeZone: string
  }
  end: {
    dateTime: string
    timeZone: string
  }
  attendees?: {
    emailAddress: { address: string; name?: string }
    type: 'required' | 'optional'
  }[]
  isOnlineMeeting?: boolean
  onlineMeetingProvider?: 'teamsForBusiness'
  onlineMeeting?: {
    joinUrl?: string
  }
  reminderMinutesBeforeStart?: number
}

// Initialize Microsoft OAuth flow
export function initOutlookAuth(): void {
  const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')

  authUrl.searchParams.set('client_id', MS_CLIENT_ID)
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('scope', SCOPES)
  authUrl.searchParams.set('response_mode', 'query')
  authUrl.searchParams.set('state', `outlook_${crypto.randomUUID()}`)

  window.location.href = authUrl.toString()
}

// Handle OAuth callback - exchange code for tokens
export async function handleOutlookCallback(
  code: string,
  userId: string
): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: MS_CLIENT_ID,
        client_secret: MS_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES,
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      throw new Error(errorData.error_description || 'Failed to exchange code')
    }

    const tokens = await tokenResponse.json()

    // Calculate expiration timestamp
    const expiresAt = Date.now() + (tokens.expires_in * 1000)

    const tokenData: OutlookTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      token_type: tokens.token_type,
    }

    // Get user email from Microsoft Graph
    const userInfoResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
      },
    })

    let outlookEmail = ''
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json()
      outlookEmail = userInfo.mail || userInfo.userPrincipalName || ''
    }

    // Save tokens to user profile
    const { error } = await supabase
      .from('users')
      .update({
        outlook_connected: true,
        outlook_token: tokenData,
        outlook_email: outlookEmail,
      })
      .eq('id', userId)

    if (error) throw error

    return { success: true, email: outlookEmail }
  } catch (error) {
    console.error('Error handling Outlook callback:', error)
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
      .select('outlook_token')
      .eq('id', userId)
      .single()

    if (error || !user?.outlook_token) {
      return null
    }

    const tokens = user.outlook_token as OutlookTokens

    // Check if token is still valid (with 5 min buffer)
    if (tokens.expires_at > Date.now() + 300000) {
      return tokens.access_token
    }

    // Refresh the token
    if (!tokens.refresh_token) {
      throw new Error('No refresh token available')
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
        scope: SCOPES,
      }),
    })

    if (!refreshResponse.ok) {
      throw new Error('Failed to refresh token')
    }

    const newTokens = await refreshResponse.json()
    const expiresAt = Date.now() + (newTokens.expires_in * 1000)

    const updatedTokenData: OutlookTokens = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token || tokens.refresh_token, // Keep original if not returned
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

// Get timezone in Windows format for Outlook
function getWindowsTimeZone(): string {
  const ianaTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  // Map common IANA timezones to Windows format
  const timezoneMap: Record<string, string> = {
    'Europe/Paris': 'Romance Standard Time',
    'Europe/London': 'GMT Standard Time',
    'America/New_York': 'Eastern Standard Time',
    'America/Los_Angeles': 'Pacific Standard Time',
    'America/Chicago': 'Central Standard Time',
    'Asia/Tokyo': 'Tokyo Standard Time',
    'Australia/Sydney': 'AUS Eastern Standard Time',
  }
  return timezoneMap[ianaTimezone] || 'UTC'
}

// Create an Outlook Calendar event
export async function createOutlookEvent(
  meeting: Meeting,
  userId: string,
  leadEmail?: string,
  createTeamsMeeting: boolean = false
): Promise<{ eventId?: string; teamsLink?: string; error?: string }> {
  try {
    const accessToken = await refreshTokenIfNeeded(userId)
    if (!accessToken) {
      return { error: 'Not authenticated with Outlook' }
    }

    const endTime = new Date(new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60000)
    const timeZone = getWindowsTimeZone()

    const event: OutlookCalendarEvent = {
      subject: meeting.title,
      body: {
        contentType: 'text',
        content: meeting.description || `RDV avec lead - ${meeting.title}`,
      },
      start: {
        dateTime: meeting.scheduled_at.replace('Z', ''),
        timeZone,
      },
      end: {
        dateTime: endTime.toISOString().replace('Z', ''),
        timeZone,
      },
      reminderMinutesBeforeStart: 30,
    }

    // Add attendee if lead has email
    if (leadEmail) {
      event.attendees = [{
        emailAddress: { address: leadEmail },
        type: 'required',
      }]
    }

    // Request Teams meeting link if video call
    if (createTeamsMeeting || meeting.type === 'video') {
      event.isOnlineMeeting = true
      event.onlineMeetingProvider = 'teamsForBusiness'
    }

    const response = await fetch('https://graph.microsoft.com/v1.0/me/calendar/events', {
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

    // Update meeting with Outlook event ID and Teams link
    const updateData: Record<string, unknown> = {
      outlook_event_id: createdEvent.id,
      outlook_calendar_synced: true,
    }

    if (createdEvent.onlineMeeting?.joinUrl) {
      updateData.outlook_teams_link = createdEvent.onlineMeeting.joinUrl
      if (!meeting.location) {
        updateData.location = createdEvent.onlineMeeting.joinUrl
      }
    }

    await supabase
      .from('meetings')
      .update(updateData)
      .eq('id', meeting.id)

    return {
      eventId: createdEvent.id,
      teamsLink: createdEvent.onlineMeeting?.joinUrl
    }
  } catch (error) {
    console.error('Error creating Outlook event:', error)
    return { error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Update an Outlook Calendar event
export async function updateOutlookEvent(
  meeting: Meeting,
  userId: string,
  leadEmail?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!meeting.outlook_event_id) {
      return { success: false, error: 'No Outlook event ID' }
    }

    const accessToken = await refreshTokenIfNeeded(userId)
    if (!accessToken) {
      return { success: false, error: 'Not authenticated with Outlook' }
    }

    const endTime = new Date(new Date(meeting.scheduled_at).getTime() + meeting.duration_minutes * 60000)
    const timeZone = getWindowsTimeZone()

    const event: Partial<OutlookCalendarEvent> = {
      subject: meeting.title,
      body: {
        contentType: 'text',
        content: meeting.description || `RDV avec lead - ${meeting.title}`,
      },
      start: {
        dateTime: meeting.scheduled_at.replace('Z', ''),
        timeZone,
      },
      end: {
        dateTime: endTime.toISOString().replace('Z', ''),
        timeZone,
      },
    }

    if (leadEmail) {
      event.attendees = [{
        emailAddress: { address: leadEmail },
        type: 'required',
      }]
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendar/events/${meeting.outlook_event_id}`,
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
    console.error('Error updating Outlook event:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Delete an Outlook Calendar event
export async function deleteOutlookEvent(
  eventId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const accessToken = await refreshTokenIfNeeded(userId)
    if (!accessToken) {
      return { success: false, error: 'Not authenticated with Outlook' }
    }

    const response = await fetch(
      `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    )

    // 204 No Content is success
    if (!response.ok && response.status !== 204 && response.status !== 404) {
      const errorData = await response.json()
      throw new Error(errorData.error?.message || 'Failed to delete event')
    }

    return { success: true }
  } catch (error) {
    console.error('Error deleting Outlook event:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

// Disconnect Outlook Calendar
export async function disconnectOutlookCalendar(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        outlook_connected: false,
        outlook_token: null,
        outlook_email: null,
      })
      .eq('id', userId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error disconnecting Outlook Calendar:', error)
    return false
  }
}

// Check if Outlook Calendar is configured
export function isOutlookCalendarConfigured(): boolean {
  return Boolean(MS_CLIENT_ID && MS_CLIENT_SECRET)
}

// Check user's Outlook Calendar connection status
export async function getOutlookCalendarStatus(userId: string): Promise<{
  connected: boolean
  email?: string
}> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('outlook_connected, outlook_email')
      .eq('id', userId)
      .single()

    if (error || !data) {
      return { connected: false }
    }

    return {
      connected: data.outlook_connected || false,
      email: data.outlook_email,
    }
  } catch {
    return { connected: false }
  }
}
