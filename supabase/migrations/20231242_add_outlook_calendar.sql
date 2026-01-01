-- Add Outlook/Microsoft 365 Calendar integration columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_connected BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_token JSONB;
ALTER TABLE users ADD COLUMN IF NOT EXISTS outlook_email TEXT;

-- Add outlook_calendar_synced to meetings for sync tracking
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS outlook_calendar_synced BOOLEAN DEFAULT false;
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS outlook_teams_link TEXT;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_meetings_outlook_event_id ON meetings(outlook_event_id) WHERE outlook_event_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_outlook ON users(outlook_connected) WHERE outlook_connected = true;
