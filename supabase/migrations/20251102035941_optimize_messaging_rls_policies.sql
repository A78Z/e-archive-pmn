/*
  # Optimisation des policies RLS pour la messagerie

  ## 1. Objectif
    - Simplifier et optimiser les policies RLS existantes
    - Améliorer les performances des requêtes
    - Garantir la sécurité tout en permettant un accès fluide

  ## 2. Policies optimisées
    - Messages : accès simplifié pour utilisateurs authentifiés
    - Channels : visibilité selon l'appartenance
    - Channel members : gestion des membres simplifiée
    - User status : lecture publique, écriture restreinte

  ## 3. Sécurité
    - Super admin et admin conservent un accès complet
    - Utilisateurs ne voient que leurs données
    - Policies simplifiées pour meilleures performances
*/

-- =====================================================
-- MESSAGES : Policies optimisées
-- =====================================================

DROP POLICY IF EXISTS "Users can view their messages" ON messages;
CREATE POLICY "Users can view their messages"
  ON messages FOR SELECT TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = messages.channel_id
      AND channel_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can send messages" ON messages;
CREATE POLICY "Users can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      receiver_id IS NOT NULL
      OR EXISTS (
        SELECT 1 FROM channel_members
        WHERE channel_members.channel_id = messages.channel_id
        AND channel_members.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can update their messages" ON messages;
CREATE POLICY "Users can update their messages"
  ON messages FOR UPDATE TO authenticated
  USING (
    sender_id = auth.uid()
    OR receiver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can delete their messages" ON messages;
CREATE POLICY "Users can delete their messages"
  ON messages FOR DELETE TO authenticated
  USING (
    sender_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- CHANNELS : Policies optimisées
-- =====================================================

DROP POLICY IF EXISTS "Users can view their channels" ON channels;
CREATE POLICY "Users can view their channels"
  ON channels FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channels.id
      AND channel_members.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can create channels" ON channels;
CREATE POLICY "Users can create channels"
  ON channels FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Admins can update channels" ON channels;
CREATE POLICY "Admins can update channels"
  ON channels FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members
      WHERE channel_members.channel_id = channels.id
      AND channel_members.user_id = auth.uid()
      AND channel_members.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete channels" ON channels;
CREATE POLICY "Admins can delete channels"
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
-- CHANNEL_MEMBERS : Policies optimisées
-- =====================================================

DROP POLICY IF EXISTS "Users can view members of their channels" ON channel_members;
CREATE POLICY "Users can view members of their channels"
  ON channel_members FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can add channel members" ON channel_members;
CREATE POLICY "Users can add channel members"
  ON channel_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM channels
      WHERE channels.id = channel_members.channel_id
      AND channels.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

DROP POLICY IF EXISTS "Users can leave channels" ON channel_members;
CREATE POLICY "Users can leave channels"
  ON channel_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channel_members cm
      WHERE cm.channel_id = channel_members.channel_id
      AND cm.user_id = auth.uid()
      AND cm.role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- USER_STATUS : Policies optimisées
-- =====================================================

DROP POLICY IF EXISTS "All users can view status" ON user_status;
CREATE POLICY "All users can view status"
  ON user_status FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert their status" ON user_status;
CREATE POLICY "Users can insert their status"
  ON user_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their status" ON user_status;
CREATE POLICY "Users can update their status"
  ON user_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their status" ON user_status;
CREATE POLICY "Users can delete their status"
  ON user_status FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- MESSAGE_REACTIONS : Policies optimisées
-- =====================================================

DROP POLICY IF EXISTS "Users can view reactions" ON message_reactions;
CREATE POLICY "Users can view reactions"
  ON message_reactions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM messages
      WHERE messages.id = message_reactions.message_id
      AND (
        messages.sender_id = auth.uid()
        OR messages.receiver_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM channel_members
          WHERE channel_members.channel_id = messages.channel_id
          AND channel_members.user_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can add reactions" ON message_reactions;
CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can remove reactions" ON message_reactions;
CREATE POLICY "Users can remove reactions"
  ON message_reactions FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- Grants explicites
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_status TO authenticated;
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
