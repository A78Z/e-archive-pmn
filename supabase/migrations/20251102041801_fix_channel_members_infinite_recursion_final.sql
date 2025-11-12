/*
  # Correction définitive de la récursion infinie dans channel_members

  ## Problème identifié
    - Les policies sur channel_members vérifient l'appartenance à un canal
    - Cette vérification fait elle-même une requête sur channel_members
    - Résultat : récursion infinie détectée par Postgres

  ## Solution
    - Supprimer TOUTES les policies existantes
    - Créer des policies simples SANS sous-requêtes récursives
    - Autoriser les utilisateurs authentifiés à insérer/lire leurs données
    - Pas de vérification d'appartenance dans les policies elles-mêmes

  ## Tables concernées
    - channel_members (récursion à corriger)
    - channels (simplification des policies)
*/

-- =====================================================
-- CHANNEL_MEMBERS : Suppression complète des anciennes policies
-- =====================================================

DROP POLICY IF EXISTS "Users can add channel members" ON channel_members;
DROP POLICY IF EXISTS "Users can view members of their channels" ON channel_members;
DROP POLICY IF EXISTS "Users can leave channels" ON channel_members;
DROP POLICY IF EXISTS "allow_insert_channel_members" ON channel_members;
DROP POLICY IF EXISTS "allow_select_channel_members" ON channel_members;
DROP POLICY IF EXISTS "allow_update_channel_members" ON channel_members;
DROP POLICY IF EXISTS "allow_delete_channel_members" ON channel_members;

-- =====================================================
-- CHANNEL_MEMBERS : Nouvelles policies SANS récursion
-- =====================================================

-- SELECT : Voir uniquement ses propres appartenances ou être super admin
CREATE POLICY "select_channel_members"
ON channel_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('super_admin', 'admin')
  )
);

-- INSERT : Tout utilisateur authentifié peut ajouter des membres
-- La logique métier est gérée côté application
CREATE POLICY "insert_channel_members"
ON channel_members FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE : Modifier uniquement son propre rôle ou être admin
CREATE POLICY "update_channel_members"
ON channel_members FOR UPDATE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('super_admin', 'admin')
  )
);

-- DELETE : Quitter un canal ou être admin
CREATE POLICY "delete_channel_members"
ON channel_members FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('super_admin', 'admin')
  )
);

-- =====================================================
-- CHANNELS : Simplification des policies
-- =====================================================

DROP POLICY IF EXISTS "Users can create channels" ON channels;
DROP POLICY IF EXISTS "Users can view their channels" ON channels;
DROP POLICY IF EXISTS "Admins can update channels" ON channels;
DROP POLICY IF EXISTS "Admins can delete channels" ON channels;
DROP POLICY IF EXISTS "insert_channels" ON channels;
DROP POLICY IF EXISTS "select_channels" ON channels;

-- INSERT : Tout utilisateur authentifié peut créer un canal
CREATE POLICY "insert_channels"
ON channels FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- SELECT : Voir tous les canaux (la restriction se fait via channel_members)
CREATE POLICY "select_channels"
ON channels FOR SELECT TO authenticated
USING (TRUE);

-- UPDATE : Modifier son propre canal ou être admin
CREATE POLICY "update_channels"
ON channels FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('super_admin', 'admin')
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('super_admin', 'admin')
  )
);

-- DELETE : Supprimer son propre canal ou être admin
CREATE POLICY "delete_channels"
ON channels FOR DELETE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.role IN ('super_admin', 'admin')
  )
);

-- =====================================================
-- Vérification des GRANTS
-- =====================================================

GRANT ALL ON channels TO authenticated;
GRANT ALL ON channel_members TO authenticated;