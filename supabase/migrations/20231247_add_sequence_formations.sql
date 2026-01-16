-- Migration: Add formation_type_ids to sequences
-- Ticket 2: Associer des séquences à des types de formation

-- Add formation_type_ids array to sequences table
ALTER TABLE sequences ADD COLUMN IF NOT EXISTS formation_type_ids UUID[] DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_sequences_formation_type_ids ON sequences USING GIN (formation_type_ids);
