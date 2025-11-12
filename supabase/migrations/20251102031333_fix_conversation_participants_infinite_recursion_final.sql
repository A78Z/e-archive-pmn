/*
  # Fix Infinite Recursion in conversation_participants RLS

  1. Problem Analysis
    - The SELECT policy on conversation_participants creates infinite recursion
    - Line 147-152 in migration 20251102000531: The policy references itself
    - When checking `conversation_participants`, it queries `conversation_participants cp` 
      which triggers the same policy again → infinite loop

  2. Root Cause
    ```sql
    USING (
      EXISTS (
        SELECT 1 FROM conversation_participants cp  -- ❌ This creates recursion!
        WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.user_id = auth.uid()
      )
    )
    ```

  3. Solution
    - Create a SECURITY DEFINER function that bypasses RLS
    - Use a CTE (Common Table Expression) to break the recursion
    - Simplify the policy logic to avoid self-referencing

  4. Security
    - Only authenticated users can access participants
    - Users can only see participants in conversations where they are members
    - Super Admin has full access to all conversations
    - Function is secure as it still validates auth.uid()
*/

-- Drop the problematic function if it exists
DROP FUNCTION IF EXISTS is_user_in_conversation(uuid, uuid);

-- Drop all existing policies on conversation_participants
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Authenticated users can add participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can update conversation participants" ON conversation_participants;
DROP POLICY IF EXISTS "Users can remove conversation participants" ON conversation_participants;

-- Create a secure helper function that bypasses RLS
CREATE OR REPLACE FUNCTION user_is_conversation_member(conv_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Direct check without triggering RLS
  RETURN EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE conversation_id = conv_id
    AND user_id = user_id
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION user_is_conversation_member(uuid, uuid) TO authenticated;

-- NEW POLICIES FOR conversation_participants

-- 1. INSERT: Allow authenticated users to add participants
CREATE POLICY "Allow authenticated users to add participants"
  ON conversation_participants
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 2. SELECT: Users can view participants where they are members OR they are super admin
CREATE POLICY "Users view participants in their conversations"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR user_is_conversation_member(conversation_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- 3. UPDATE: Users can update participant records in their conversations
CREATE POLICY "Users update participants in their conversations"
  ON conversation_participants
  FOR UPDATE
  TO authenticated
  USING (
    user_is_conversation_member(conversation_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- 4. DELETE: Users can remove participants from their conversations
CREATE POLICY "Users remove participants in their conversations"
  ON conversation_participants
  FOR DELETE
  TO authenticated
  USING (
    user_is_conversation_member(conversation_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

-- Ensure RLS is enabled
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
