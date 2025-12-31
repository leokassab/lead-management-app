-- Migration: Add AI search suggestion columns
-- Run this in Supabase SQL Editor

ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_search_performed BOOLEAN DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_search_results JSONB;
