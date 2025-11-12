/*
  # Ajout du numéro de dossier et préférences utilisateur

  ## Modifications
    1. Ajout du champ folder_number à la table folders
       - folder_number (text, nullable) : Numéro manuel du dossier (ex: D-001, CAISSE-12-D04)
       - status (text) : Statut du dossier (Archive, En cours, Nouveau)
    
    2. Création de la table user_preferences
       - display_mode (text) : Mode d'affichage (very_large, large, medium)
       - user_id référence users.id
    
  ## Sécurité
    - RLS activé sur user_preferences
    - Chaque utilisateur ne peut voir/modifier que ses propres préférences
*/

-- =====================================================
-- 1. Ajout du numéro de dossier et statut à folders
-- =====================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'folder_number'
  ) THEN
    ALTER TABLE folders ADD COLUMN folder_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'status'
  ) THEN
    ALTER TABLE folders ADD COLUMN status text DEFAULT 'Archive';
  END IF;
END $$;

-- Créer un index sur folder_number pour la recherche
CREATE INDEX IF NOT EXISTS idx_folders_folder_number ON folders(folder_number);

-- Commentaires
COMMENT ON COLUMN folders.folder_number IS 'Numéro manuel du dossier attribué par le Super Admin';
COMMENT ON COLUMN folders.status IS 'Statut du dossier: Archive, En cours, Nouveau';

-- =====================================================
-- 2. Création de la table user_preferences
-- =====================================================

CREATE TABLE IF NOT EXISTS user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_mode text NOT NULL DEFAULT 'large',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Index
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

-- Commentaires
COMMENT ON TABLE user_preferences IS 'Préférences utilisateur pour l''affichage';
COMMENT ON COLUMN user_preferences.display_mode IS 'Taille d''affichage: very_large, large, medium';

-- =====================================================
-- 3. RLS pour user_preferences
-- =====================================================

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

-- SELECT : Voir uniquement ses propres préférences
CREATE POLICY "select_own_preferences"
ON user_preferences FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- INSERT : Créer ses propres préférences
CREATE POLICY "insert_own_preferences"
ON user_preferences FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- UPDATE : Modifier uniquement ses propres préférences
CREATE POLICY "update_own_preferences"
ON user_preferences FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- DELETE : Supprimer ses propres préférences
CREATE POLICY "delete_own_preferences"
ON user_preferences FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 4. Fonction trigger pour updated_at
-- =====================================================

CREATE OR REPLACE FUNCTION update_user_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_preferences_updated_at_trigger ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at_trigger
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_preferences_updated_at();

-- =====================================================
-- 5. Grants
-- =====================================================

GRANT ALL ON user_preferences TO authenticated;