/*
  # Système de messagerie moderne pour Archive PMN v1.0

  ## 1. Tables créées
    - `channels` : Canaux de discussion (départements, projets)
      - id, name, description, type, created_by, created_at, updated_at
    
    - `channel_members` : Membres des canaux
      - id, channel_id, user_id, role, joined_at
    
    - `messages` : Messages et contenus
      - id, sender_id, receiver_id, channel_id, content, type, attachments, read, created_at, updated_at
    
    - `user_status` : Statut en ligne des utilisateurs
      - user_id, status, last_seen, updated_at
    
    - `message_reactions` : Réactions emoji aux messages
      - id, message_id, user_id, emoji, created_at

  ## 2. Sécurité RLS
    - Toutes les tables ont RLS activé
    - Policies restrictives basées sur l'authentification
    - Super admin et admin voient tout
    - Utilisateurs voient uniquement leurs conversations/canaux

  ## 3. Indexes
    - Indexes sur foreign keys pour performance
    - Index sur created_at pour tri chronologique
*/

-- =====================================================
-- 1. CHANNELS
-- =====================================================

CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL DEFAULT 'general' CHECK (type IN ('department', 'project', 'general')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. CHANNEL_MEMBERS
-- =====================================================

CREATE TABLE channel_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 3. MESSAGES
-- =====================================================

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'file', 'image')),
  attachments jsonb DEFAULT '[]'::jsonb,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (
    (receiver_id IS NOT NULL AND channel_id IS NULL) OR
    (receiver_id IS NULL AND channel_id IS NOT NULL)
  )
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. USER_STATUS
-- =====================================================

CREATE TABLE user_status (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'away')),
  last_seen timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_status ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 5. MESSAGE_REACTIONS
-- =====================================================

CREATE TABLE message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 6. RLS POLICIES - CHANNELS
-- =====================================================

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

CREATE POLICY "Users can create channels"
  ON channels FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins can update channels"
  ON channels FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  );

-- =====================================================
-- 7. RLS POLICIES - CHANNEL_MEMBERS
-- =====================================================

CREATE POLICY "Users can view members of their channels"
  ON channel_members FOR SELECT TO authenticated
  USING (
    EXISTS (
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

CREATE POLICY "Users can add channel members"
  ON channel_members FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can leave channels"
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
-- 8. RLS POLICIES - MESSAGES
-- =====================================================

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

CREATE POLICY "Users can send messages"
  ON messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update their messages"
  ON messages FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

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
-- 9. RLS POLICIES - USER_STATUS
-- =====================================================

CREATE POLICY "All users can view status"
  ON user_status FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert their status"
  ON user_status FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their status"
  ON user_status FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 10. RLS POLICIES - MESSAGE_REACTIONS
-- =====================================================

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

CREATE POLICY "Users can add reactions"
  ON message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove reactions"
  ON message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- =====================================================
-- 11. INDEXES
-- =====================================================

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_channel ON messages(channel_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
CREATE INDEX idx_channel_members_user ON channel_members(user_id);
CREATE INDEX idx_channel_members_channel ON channel_members(channel_id);
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);

-- =====================================================
-- 12. TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_channels_updated_at
  BEFORE UPDATE ON channels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_status_updated_at
  BEFORE UPDATE ON user_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 13. GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON channels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON channel_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON messages TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_status TO authenticated;
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
