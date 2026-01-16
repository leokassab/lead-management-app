-- Migration: Add duplicate tracking columns to leads
-- Ticket 5: Ne pas supprimer les doublons automatiquement, les mettre en avant

-- Add duplicate tracking columns to leads table
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duplicate_of UUID REFERENCES leads(id) ON DELETE SET NULL;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duplicate_detected_at TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS duplicate_fields JSONB DEFAULT '[]'; -- ["email", "phone"] - fields that match

-- Create index for faster duplicate lookups
CREATE INDEX IF NOT EXISTS idx_leads_is_duplicate ON leads(is_duplicate) WHERE is_duplicate = true;
CREATE INDEX IF NOT EXISTS idx_leads_duplicate_of ON leads(duplicate_of) WHERE duplicate_of IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN leads.is_duplicate IS 'True if this lead is a duplicate of an existing lead';
COMMENT ON COLUMN leads.duplicate_of IS 'Reference to the original lead if this is a duplicate';
COMMENT ON COLUMN leads.duplicate_detected_at IS 'When the duplicate was detected';
COMMENT ON COLUMN leads.duplicate_fields IS 'Array of field names that match the original lead (email, phone)';
