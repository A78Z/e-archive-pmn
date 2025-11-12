/*
  # Correction définitive des policies RLS pour la messagerie

  ## Problème identifié
    - Policy INSERT sur messages : vérifie l'appartenance au canal AVANT que le canal existe
    - Policy INSERT sur channel_members : vérifie l'appartenance au canal AVANT l'insertion
    - Résultat : blocage RLS sur toutes les créations

  ## Solution
    - Simplifier drastiquement les policies INSERT
    - Permettre aux utilisateurs authentifiés d'insérer librement
    - Garder les restrictions sur SELECT/UPDATE/DELETE

  ## Tables concernées
    - channels
    - channel_members  
    - messages
*/

-- =====================================================
-- CHANNELS : Policies INSERT simplifiées
-- =====================================================

DROP POLICY IF EXISTS "Users can create channels" ON channels;
CREATE POLICY "Users can create channels"
  ON channels FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- CHANNEL_MEMBERS : Policy INSERT simplifiée
-- =====================================================

DROP POLICY IF EXISTS "Users can add channel members" ON channel_members;
CREATE POLICY "Users can add channel members"
  ON channel_members FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- =====================================================
-- MESSAGES : Policy INSERT simplifiée
-- =====================================================

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (receiver_id IS NOT NULL OR channel_id IS NOT NULL)
  );

-- =====================================================
-- Vérification des GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
