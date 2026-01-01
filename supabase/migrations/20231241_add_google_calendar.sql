-- Add Google Calendar integration columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_connected BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_token JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_calendar_email TEXT;

-- Add google_event_id to meetings for sync tracking
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_calendar_synced BOOLEAN DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS google_meet_link TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_google_event_id ON meetings(google_event_id) WHERE google_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_calendar ON users(google_calendar_connected) WHERE google_calendar_connected = true;
