/*
  # Amélioration du système de partage

  ## Modifications principales

  1. Ajout de colonnes à la table shares
    - `can_read` (boolean) : Permission de lecture
    - `can_write` (boolean) : Permission d'écriture
    - `can_delete` (boolean) : Permission de suppression
    - `can_share` (boolean) : Permission de repartager
    - `share_token` (text, unique) : Token unique pour le lien de partage
    - `expires_at` (timestamptz) : Date d'expiration du partage (optionnel)
    - `is_link_share` (boolean) : Indique si c'est un partage par lien

  2. Suppression de la contrainte permission_check existante

  3. Ajout d'index pour améliorer les performances
    - Index sur share_token pour recherche rapide
    - Index sur document_id et shared_with pour recherche de partages

  4. Sécurité
    - RLS policies mises à jour pour gérer les nouveaux champs
    - Policies pour les partages par lien (accès public avec token)
*/

-- Supprimer la contrainte existante sur permission
ALTER TABLE shares DROP CONSTRAINT IF EXISTS shares_permission_check;

-- Ajouter les nouvelles colonnes pour les permissions détaillées
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'can_read'
  ) THEN
    ALTER TABLE shares ADD COLUMN can_read boolean DEFAULT true NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'can_write'
  ) THEN
    ALTER TABLE shares ADD COLUMN can_write boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'can_delete'
  ) THEN
    ALTER TABLE shares ADD COLUMN can_delete boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'can_share'
  ) THEN
    ALTER TABLE shares ADD COLUMN can_share boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'share_token'
  ) THEN
    ALTER TABLE shares ADD COLUMN share_token text UNIQUE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'expires_at'
  ) THEN
    ALTER TABLE shares ADD COLUMN expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shares' AND column_name = 'is_link_share'
  ) THEN
    ALTER TABLE shares ADD COLUMN is_link_share boolean DEFAULT false NOT NULL;
  END IF;
END $$;

-- Créer un index sur share_token pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_shares_share_token ON shares(share_token);

-- Créer un index composite sur document_id et shared_with
CREATE INDEX IF NOT EXISTS idx_shares_document_shared_with ON shares(document_id, shared_with);

-- Mettre à jour la colonne permission pour être optionnelle (legacy support)
ALTER TABLE shares ALTER COLUMN permission DROP NOT NULL;
ALTER TABLE shares ALTER COLUMN permission DROP DEFAULT;

-- Ajouter une contrainte pour s'assurer qu'au moins la lecture est activée
ALTER TABLE shares ADD CONSTRAINT shares_at_least_one_permission CHECK (
  can_read = true OR can_write = true OR can_delete = true OR can_share = true
);

-- Mettre à jour les RLS policies pour gérer les partages par lien
DROP POLICY IF EXISTS "Users can view shares where they are recipient" ON shares;
DROP POLICY IF EXISTS "Users can view shares they created" ON shares;
DROP POLICY IF EXISTS "Users can create shares" ON shares;
DROP POLICY IF EXISTS "Users can delete shares they created" ON shares;

-- Policy pour voir les partages où l'utilisateur est destinataire
CREATE POLICY "Users can view shares where they are recipient"
  ON shares FOR SELECT
  TO authenticated
  USING (shared_with = auth.uid() OR shared_by = auth.uid());

-- Policy pour voir les partages par lien (lecture seule avec token valide)
CREATE POLICY "Anyone can view link shares with valid token"
  ON shares FOR SELECT
  TO anon, authenticated
  USING (
    is_link_share = true 
    AND share_token IS NOT NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

-- Policy pour créer des partages
CREATE POLICY "Users can create shares"
  ON shares FOR INSERT
  TO authenticated
  WITH CHECK (shared_by = auth.uid());

-- Policy pour supprimer les partages créés par l'utilisateur
CREATE POLICY "Users can delete their own shares"
  ON shares FOR DELETE
  TO authenticated
  USING (shared_by = auth.uid());

-- Policy pour mettre à jour les partages créés par l'utilisateur
CREATE POLICY "Users can update their own shares"
  ON shares FOR UPDATE
  TO authenticated
  USING (shared_by = auth.uid())
  WITH CHECK (shared_by = auth.uid());