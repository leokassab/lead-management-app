-- Migration: Enhance scripts table for personalized generation
-- Run this in Supabase SQL Editor

-- Add new columns to scripts table
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS generation_context JSONB;
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS effectiveness_rating INT CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5);
ALTER TABLE scripts ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Add source_campaign and product_interest to leads for script personalization
ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_campaign TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS product_interest TEXT;

-- Index for faster queries on scripts
CREATE INDEX IF NOT EXISTS idx_scripts_lead_id ON scripts(lead_id);
CREATE INDEX IF NOT EXISTS idx_scripts_generated_at ON scripts(generated_at);
