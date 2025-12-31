-- Migration: Add SLA Tracking
-- Ticket 19: Délais & SLA

-- SLA par équipe (temps par défaut pour premier contact)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS default_sla_hours INT DEFAULT 24;

-- SLA personnalisé par commercial (override le SLA équipe)
ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_sla_hours INT;

-- Colonne first_contact_at sur leads si pas déjà présente
ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_contact_at TIMESTAMPTZ;

-- Table de tracking SLA
CREATE TABLE IF NOT EXISTS sla_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  sla_type TEXT CHECK (sla_type IN ('first_contact', 'response', 'follow_up')) NOT NULL,
  sla_deadline TIMESTAMPTZ NOT NULL,
  sla_hours INT NOT NULL, -- Nombre d'heures SLA au moment de la création
  status TEXT CHECK (status IN ('pending', 'met', 'breached')) DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_sla_tracking_lead ON sla_tracking(lead_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_user ON sla_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_team ON sla_tracking(team_id);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_status ON sla_tracking(status);
CREATE INDEX IF NOT EXISTS idx_sla_tracking_deadline ON sla_tracking(sla_deadline);

-- Index pour first_contact_at sur leads
CREATE INDEX IF NOT EXISTS idx_leads_first_contact ON leads(first_contact_at);

-- RLS Policies
ALTER TABLE sla_tracking ENABLE ROW LEVEL SECURITY;

-- Membres de l'équipe peuvent voir les SLA de leur équipe
CREATE POLICY "Team members can view SLA tracking"
  ON sla_tracking FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  );

-- Membres peuvent créer des SLA pour leur équipe
CREATE POLICY "Team members can create SLA tracking"
  ON sla_tracking FOR INSERT
  WITH CHECK (
    team_id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  );

-- Membres peuvent mettre à jour les SLA de leur équipe
CREATE POLICY "Team members can update SLA tracking"
  ON sla_tracking FOR UPDATE
  USING (
    team_id IN (
      SELECT team_id FROM users WHERE id = auth.uid()
    )
  );

-- Fonction pour créer automatiquement un SLA tracking quand un lead est assigné
CREATE OR REPLACE FUNCTION create_sla_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_sla_hours INT;
  v_team_id UUID;
BEGIN
  -- Seulement si assigned_to change et n'est pas null
  IF NEW.assigned_to IS NOT NULL AND (OLD.assigned_to IS NULL OR OLD.assigned_to != NEW.assigned_to) THEN
    -- Récupérer le team_id et le SLA hours
    SELECT
      u.team_id,
      COALESCE(u.personal_sla_hours, t.default_sla_hours, 24)
    INTO v_team_id, v_sla_hours
    FROM users u
    LEFT JOIN teams t ON t.id = u.team_id
    WHERE u.id = NEW.assigned_to;

    -- Créer le SLA tracking pour first_contact
    INSERT INTO sla_tracking (lead_id, user_id, team_id, sla_type, sla_deadline, sla_hours)
    VALUES (
      NEW.id,
      NEW.assigned_to,
      v_team_id,
      'first_contact',
      NOW() + (v_sla_hours || ' hours')::INTERVAL,
      v_sla_hours
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour créer SLA à l'assignation
DROP TRIGGER IF EXISTS trigger_create_sla_on_assignment ON leads;
CREATE TRIGGER trigger_create_sla_on_assignment
  AFTER INSERT OR UPDATE OF assigned_to ON leads
  FOR EACH ROW
  EXECUTE FUNCTION create_sla_on_assignment();

-- Fonction pour marquer le SLA comme respecté quand first_contact_at est renseigné
CREATE OR REPLACE FUNCTION update_sla_on_first_contact()
RETURNS TRIGGER AS $$
BEGIN
  -- Si first_contact_at vient d'être renseigné
  IF NEW.first_contact_at IS NOT NULL AND OLD.first_contact_at IS NULL THEN
    UPDATE sla_tracking
    SET
      status = CASE
        WHEN NEW.first_contact_at <= sla_deadline THEN 'met'
        ELSE 'breached'
      END,
      completed_at = NEW.first_contact_at,
      updated_at = NOW()
    WHERE lead_id = NEW.id
      AND sla_type = 'first_contact'
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger pour mettre à jour SLA au premier contact
DROP TRIGGER IF EXISTS trigger_update_sla_on_first_contact ON leads;
CREATE TRIGGER trigger_update_sla_on_first_contact
  AFTER UPDATE OF first_contact_at ON leads
  FOR EACH ROW
  EXECUTE FUNCTION update_sla_on_first_contact();

-- Fonction pour marquer les SLA expirés comme breached (à appeler via cron ou manuellement)
CREATE OR REPLACE FUNCTION check_breached_slas()
RETURNS INT AS $$
DECLARE
  updated_count INT;
BEGIN
  UPDATE sla_tracking
  SET
    status = 'breached',
    updated_at = NOW()
  WHERE status = 'pending'
    AND sla_deadline < NOW();

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Vue pour les statistiques SLA par commercial
CREATE OR REPLACE VIEW sla_stats_by_user AS
SELECT
  s.user_id,
  s.team_id,
  u.first_name,
  u.last_name,
  COUNT(*) FILTER (WHERE s.sla_type = 'first_contact') as total_sla,
  COUNT(*) FILTER (WHERE s.status = 'met') as sla_met,
  COUNT(*) FILTER (WHERE s.status = 'breached') as sla_breached,
  COUNT(*) FILTER (WHERE s.status = 'pending') as sla_pending,
  ROUND(
    COUNT(*) FILTER (WHERE s.status = 'met')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE s.status IN ('met', 'breached')), 0) * 100,
    1
  ) as sla_met_percentage,
  AVG(
    EXTRACT(EPOCH FROM (s.completed_at - s.created_at)) / 3600
  ) FILTER (WHERE s.completed_at IS NOT NULL) as avg_response_hours,
  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (s.completed_at - s.created_at)) / 3600
  ) FILTER (WHERE s.completed_at IS NOT NULL) as median_response_hours
FROM sla_tracking s
JOIN users u ON u.id = s.user_id
GROUP BY s.user_id, s.team_id, u.first_name, u.last_name;
