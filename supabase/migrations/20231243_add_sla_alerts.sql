-- Migration: Add SLA Alerts
-- Ticket 23: Alertes automatiques pour managers quand SLA dépassé

-- Colonnes pour tracker les notifications envoyées
ALTER TABLE sla_tracking ADD COLUMN IF NOT EXISTS warning_sent BOOLEAN DEFAULT false;
ALTER TABLE sla_tracking ADD COLUMN IF NOT EXISTS breach_sent BOOLEAN DEFAULT false;
ALTER TABLE sla_tracking ADD COLUMN IF NOT EXISTS warning_sent_at TIMESTAMPTZ;
ALTER TABLE sla_tracking ADD COLUMN IF NOT EXISTS breach_sent_at TIMESTAMPTZ;

-- Index pour les requêtes d'alertes
CREATE INDEX IF NOT EXISTS idx_sla_tracking_warning ON sla_tracking(warning_sent) WHERE warning_sent = false;
CREATE INDEX IF NOT EXISTS idx_sla_tracking_breach ON sla_tracking(breach_sent) WHERE breach_sent = false;

-- Fonction pour vérifier les SLA et créer des notifications
-- À 80% du temps écoulé → warning au commercial
-- À 100% (breach) → notification au commercial + manager
CREATE OR REPLACE FUNCTION check_sla_alerts()
RETURNS TABLE (
  sla_id UUID,
  alert_type TEXT,
  lead_id UUID,
  user_id UUID,
  team_id UUID,
  lead_name TEXT,
  time_remaining INTERVAL,
  percentage_elapsed NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id as sla_id,
    CASE
      WHEN NOW() >= s.sla_deadline THEN 'breach'
      WHEN NOW() >= s.created_at + (s.sla_deadline - s.created_at) * 0.8 THEN 'warning'
      ELSE NULL
    END as alert_type,
    s.lead_id,
    s.user_id,
    s.team_id,
    COALESCE(l.full_name, l.first_name || ' ' || l.last_name, l.company_name, 'Lead inconnu') as lead_name,
    s.sla_deadline - NOW() as time_remaining,
    ROUND(
      EXTRACT(EPOCH FROM (NOW() - s.created_at)) /
      NULLIF(EXTRACT(EPOCH FROM (s.sla_deadline - s.created_at)), 0) * 100,
      1
    ) as percentage_elapsed
  FROM sla_tracking s
  JOIN leads l ON l.id = s.lead_id
  WHERE s.status = 'pending'
    AND (
      -- Warning: 80%+ elapsed and not yet sent
      (NOW() >= s.created_at + (s.sla_deadline - s.created_at) * 0.8 AND s.warning_sent = false)
      OR
      -- Breach: deadline passed and not yet sent
      (NOW() >= s.sla_deadline AND s.breach_sent = false)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction pour marquer les alertes comme envoyées
CREATE OR REPLACE FUNCTION mark_sla_alert_sent(
  p_sla_id UUID,
  p_alert_type TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  IF p_alert_type = 'warning' THEN
    UPDATE sla_tracking
    SET warning_sent = true, warning_sent_at = NOW()
    WHERE id = p_sla_id;
  ELSIF p_alert_type = 'breach' THEN
    UPDATE sla_tracking
    SET breach_sent = true, breach_sent_at = NOW(), status = 'breached'
    WHERE id = p_sla_id;
  END IF;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vue pour le widget managers : SLA en alerte dans l'équipe
CREATE OR REPLACE VIEW sla_team_alerts AS
SELECT
  s.id as sla_id,
  s.lead_id,
  s.user_id,
  s.team_id,
  s.sla_type,
  s.sla_deadline,
  s.status,
  s.warning_sent,
  s.breach_sent,
  s.created_at,
  COALESCE(l.full_name, l.first_name || ' ' || l.last_name, l.company_name) as lead_name,
  l.email as lead_email,
  l.phone as lead_phone,
  u.first_name as user_first_name,
  u.last_name as user_last_name,
  u.email as user_email,
  u.avatar_url as user_avatar,
  CASE
    WHEN NOW() >= s.sla_deadline THEN 'breached'
    WHEN NOW() >= s.created_at + (s.sla_deadline - s.created_at) * 0.8 THEN 'warning'
    ELSE 'ok'
  END as alert_status,
  s.sla_deadline - NOW() as time_remaining,
  ROUND(
    EXTRACT(EPOCH FROM (NOW() - s.created_at)) /
    NULLIF(EXTRACT(EPOCH FROM (s.sla_deadline - s.created_at)), 0) * 100,
    1
  ) as percentage_elapsed
FROM sla_tracking s
JOIN leads l ON l.id = s.lead_id
JOIN users u ON u.id = s.user_id
WHERE s.status = 'pending';
