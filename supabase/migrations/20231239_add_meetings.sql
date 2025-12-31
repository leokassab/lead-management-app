-- Migration: Add meetings table for appointment management
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  title TEXT NOT NULL,
  description TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT DEFAULT 30,
  type TEXT CHECK (type IN ('call', 'video', 'in_person')) DEFAULT 'call',
  location TEXT,

  status TEXT CHECK (status IN ('scheduled', 'confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled')) DEFAULT 'scheduled',

  reminder_24h_sent BOOLEAN DEFAULT false,
  reminder_1h_sent BOOLEAN DEFAULT false,
  reminder_email_lead BOOLEAN DEFAULT true,
  reminder_sms_lead BOOLEAN DEFAULT false,

  google_event_id TEXT,
  outlook_event_id TEXT,

  notes TEXT,
  outcome TEXT,
  next_steps TEXT,

  no_show_followup_sent BOOLEAN DEFAULT false,
  rescheduled_from UUID REFERENCES meetings(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_meetings_team ON meetings(team_id);
CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(user_id);
CREATE INDEX IF NOT EXISTS idx_meetings_lead ON meetings(lead_id);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- Enable RLS
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their team's meetings"
  ON meetings FOR SELECT
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert meetings for their team"
  ON meetings FOR INSERT
  WITH CHECK (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update their team's meetings"
  ON meetings FOR UPDATE
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete their team's meetings"
  ON meetings FOR DELETE
  USING (team_id IN (SELECT team_id FROM users WHERE id = auth.uid()));
