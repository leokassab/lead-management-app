-- Migration: Add lead enrichment columns
-- Run this in Supabase SQL Editor

-- Email validation fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_validated BOOLEAN;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_validation_date TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_type TEXT CHECK (email_type IN ('professional', 'personal', 'disposable', 'unknown'));

-- Phone validation fields
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_validated BOOLEAN;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_validation_date TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_type TEXT CHECK (phone_type IN ('mobile', 'landline', 'voip', 'unknown'));

-- Enrichment tracking
ALTER TABLE leads ADD COLUMN IF NOT EXISTS enriched_at TIMESTAMPTZ;
