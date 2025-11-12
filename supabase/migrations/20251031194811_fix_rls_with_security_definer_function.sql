/*
  # Fix RLS infinite recursion with security definer function

  1. Problem
    - RLS policies create infinite recursion when checking conversation_participants

  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS
    - Use this function in RLS policies to break the recursion cycle

  3. Security
    - Function is SECURITY DEFINER (runs with creator privileges)
    - Still checks auth.uid() so it's secure
    - Prevents infinite recursion by bypassing RLS in the function
*/

-- Drop existing policy first
DROP POLICY IF EXISTS "Users can view conversation participants" ON conversation_participants;

-- Create a security definer function to check if user is in conversation
CREATE OR REPLACE FUNCTION is_user_in_conversation(conversation_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM conversation_participants
    WHERE conversation_id = conversation_uuid
    AND user_id = user_uuid
  );
$$;

-- Now create the policy using the function
CREATE POLICY "Users can view conversation participants"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_user_in_conversation(conversation_id, auth.uid())
  );
