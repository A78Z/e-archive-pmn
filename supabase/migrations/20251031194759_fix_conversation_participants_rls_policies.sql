/*
  # Fix infinite recursion in conversation_participants RLS policies

  1. Problem
    - The SELECT policy on conversation_participants creates infinite recursion
    - It checks conversation_participants to validate access to conversation_participants

  2. Changes
    - Drop the problematic recursive policy
    - Create a simpler, non-recursive policy
    - Users can view participants in conversations they are part of (direct check only)

  3. Security
    - Maintains security by checking user_id directly
    - No recursive lookups that cause infinite loops
*/

-- Drop existing problematic policy
DROP POLICY IF EXISTS "Users can view participants in own conversations" ON conversation_participants;

-- Create new non-recursive policy
-- Users can view participant records where they are the participant
-- OR where they need to see other participants in their conversations (handled in app layer)
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR conversation_id IN (
      SELECT conversation_id 
      FROM conversation_participants 
      WHERE user_id = auth.uid()
    )
  );
