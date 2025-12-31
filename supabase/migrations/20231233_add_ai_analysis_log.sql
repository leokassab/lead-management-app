-- Migration: Add AI analysis log table and AI config columns
-- Run this in Supabase SQL Editor

-- Table pour l'historique des analyses IA
CREATE TABLE IF NOT EXISTS ai_analysis_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  analysis_type TEXT CHECK (analysis_type IN ('initial_scoring', 'rescore', 'action_recommendation', 'enrichment')) NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  reasoning TEXT,
  confidence FLOAT,
  model_used TEXT DEFAULT 'gpt-4o-mini',
  tokens_used INT,
  processing_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_analysis_log_lead_id ON ai_analysis_log(lead_id);
CREATE INDEX IF NOT EXISTS idx_ai_analysis_log_created_at ON ai_analysis_log(created_at);

-- Colonnes sur leads pour l'historique IA
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_history JSONB DEFAULT '[]';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_analysis_date TIMESTAMPTZ;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_reasoning TEXT;

-- Configuration IA par équipe
ALTER TABLE teams ADD COLUMN IF NOT EXISTS ai_config JSONB DEFAULT '{
  "auto_scoring": true,
  "auto_action_recommendation": false,
  "auto_enrichment": false,
  "auto_script_generation": false
}';

-- Enable RLS on ai_analysis_log
ALTER TABLE ai_analysis_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_analysis_log
CREATE POLICY "Users can view their team's AI analysis logs"
  ON ai_analysis_log FOR SELECT
  USING (lead_id IN (
    SELECT id FROM leads WHERE team_id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  ));

CREATE POLICY "Users can insert AI analysis logs for their team's leads"
  ON ai_analysis_log FOR INSERT
  WITH CHECK (lead_id IN (
    SELECT id FROM leads WHERE team_id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  ));
