-- Migration: Add sequence helper functions
-- Run this in Supabase SQL Editor

-- Function to increment total_enrolled for a sequence
CREATE OR REPLACE FUNCTION increment_sequence_enrolled(seq_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sequences
  SET total_enrolled = total_enrolled + 1,
      updated_at = NOW()
  WHERE id = seq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment total_completed for a sequence
CREATE OR REPLACE FUNCTION increment_sequence_completed(seq_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sequences
  SET total_completed = total_completed + 1,
      updated_at = NOW()
  WHERE id = seq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment total_converted for a sequence
CREATE OR REPLACE FUNCTION increment_sequence_converted(seq_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE sequences
  SET total_converted = total_converted + 1,
      updated_at = NOW()
  WHERE id = seq_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_sequence_enrolled(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_sequence_completed(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION increment_sequence_converted(UUID) TO authenticated;
