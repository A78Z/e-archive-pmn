/*
  # Amélioration du système de demandes d'accès
  
  1. Modifications de la table access_requests
    - Ajout de `reason` (text) : motif de la demande
    - Ajout de `requested_permissions` (jsonb) : permissions demandées (read, write, delete, share)
    - Ajout de `rejection_reason` (text) : raison du rejet
    
  2. Sécurité
    - Les policies RLS existantes sont maintenues
    - Pas de changement aux permissions
    
  3. Notes importantes
    - Les colonnes sont ajoutées uniquement si elles n'existent pas déjà
    - Pas de perte de données
    - Compatible avec les données existantes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'reason'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'requested_permissions'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN requested_permissions jsonb DEFAULT '{"can_read": true, "can_write": false, "can_delete": false, "can_share": false}'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'access_requests' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE access_requests ADD COLUMN rejection_reason text;
  END IF;
END $$;