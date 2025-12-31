-- Migration: Add action system to leads table
-- This separates ACTIONS (what to do) from STATUS (where the lead is in the pipeline)

-- Add action columns to leads table
ALTER TABLE leads
ADD COLUMN IF NOT EXISTS current_action TEXT DEFAULT 'none'
CHECK (current_action IN (
  'call_today',
  'send_email',
  'send_whatsapp',
  'send_sms',
  'follow_up',
  'waiting_response',
  'schedule_meeting',
  'meeting_scheduled',
  'send_proposal',
  'negotiate',
  'do_not_contact',
  'none'
));

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS current_action_date TIMESTAMPTZ;

ALTER TABLE leads
ADD COLUMN IF NOT EXISTS current_action_note TEXT;

-- Create index for efficient filtering by action
CREATE INDEX IF NOT EXISTS idx_leads_current_action ON leads(current_action);
CREATE INDEX IF NOT EXISTS idx_leads_current_action_date ON leads(current_action_date);

-- Comment for documentation
COMMENT ON COLUMN leads.current_action IS 'The next action to take on this lead';
COMMENT ON COLUMN leads.current_action_date IS 'When the action should be performed';
COMMENT ON COLUMN leads.current_action_note IS 'Additional notes about the action';
