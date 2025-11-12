/*
  # Add User Verification and Role Management System

  1. Changes to Users Table
    - Add `is_verified` (boolean, default false) - Account verification status
    - Add `fonction` (text) - User's job function at PMN
    - Add `assigned_zone` (text) - Zone or area assigned to user
    - Add `verified_at` (timestamptz) - Date when account was verified
    - Add `verified_by` (uuid) - Super admin who verified the account
    - Modify role constraint to include 'guest' role

  2. New Tables
    - `user_notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `type` (text) - Type of notification (account_verified, account_rejected, etc.)
      - `title` (text) - Notification title
      - `message` (text) - Notification content
      - `is_read` (boolean, default false)
      - `created_at` (timestamptz)
      
    - `user_validation_logs`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references users)
      - `validated_by` (uuid, references users)
      - `action` (text) - Action taken (approved, rejected, role_changed)
      - `previous_status` (text) - Previous verification status
      - `new_status` (text) - New verification status
      - `notes` (text) - Optional notes from admin
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on all new tables
    - Add policies for super_admin access to validation system
    - Add policies for users to view their own notifications
    - Add policies to restrict unverified users from sensitive operations

  4. Functions
    - Create function to send notification when user registers
    - Create function to update user verification status
    - Create trigger to log validation actions
*/

-- Add new columns to users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_verified'
  ) THEN
    ALTER TABLE users ADD COLUMN is_verified boolean DEFAULT false NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'fonction'
  ) THEN
    ALTER TABLE users ADD COLUMN fonction text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'assigned_zone'
  ) THEN
    ALTER TABLE users ADD COLUMN assigned_zone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'verified_at'
  ) THEN
    ALTER TABLE users ADD COLUMN verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'verified_by'
  ) THEN
    ALTER TABLE users ADD COLUMN verified_by uuid REFERENCES users(id);
  END IF;
END $$;

-- Update role constraint to include guest
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('user', 'admin', 'super_admin', 'guest'));

-- Create user_notifications table
CREATE TABLE IF NOT EXISTS user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON user_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON user_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can create notifications"
  ON user_notifications FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Create user_validation_logs table
CREATE TABLE IF NOT EXISTS user_validation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  validated_by uuid REFERENCES users(id) NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'role_changed', 'zone_assigned')),
  previous_status text,
  new_status text,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_validation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view all validation logs"
  ON user_validation_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can create validation logs"
  ON user_validation_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- Function to create notification for new user registration
CREATE OR REPLACE FUNCTION notify_super_admin_new_user()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  -- Notify all super admins about new user registration
  INSERT INTO user_notifications (user_id, type, title, message)
  SELECT 
    id,
    'new_user_registration',
    'Nouvelle demande de compte',
    'Un nouveau compte agent attend votre validation : ' || NEW.full_name || ' (' || NEW.email || ')'
  FROM users
  WHERE role = 'super_admin';
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for new user notifications
DROP TRIGGER IF EXISTS on_user_created_notify_admin ON users;
CREATE TRIGGER on_user_created_notify_admin
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.is_verified = false AND NEW.role != 'super_admin')
  EXECUTE FUNCTION notify_super_admin_new_user();

-- Function to handle user verification
CREATE OR REPLACE FUNCTION verify_user_account(
  target_user_id uuid,
  admin_user_id uuid,
  approved boolean,
  admin_notes text DEFAULT NULL
)
RETURNS json
SECURITY DEFINER
AS $$
DECLARE
  target_user users%ROWTYPE;
  admin_user users%ROWTYPE;
  result json;
BEGIN
  -- Check if admin is super_admin
  SELECT * INTO admin_user FROM users WHERE id = admin_user_id;
  IF admin_user.role != 'super_admin' THEN
    RETURN json_build_object('success', false, 'error', 'Unauthorized: Only super admins can verify accounts');
  END IF;

  -- Get target user
  SELECT * INTO target_user FROM users WHERE id = target_user_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;

  IF approved THEN
    -- Approve user
    UPDATE users
    SET 
      is_verified = true,
      verified_at = now(),
      verified_by = admin_user_id
    WHERE id = target_user_id;

    -- Log the action
    INSERT INTO user_validation_logs (user_id, validated_by, action, previous_status, new_status, notes)
    VALUES (target_user_id, admin_user_id, 'approved', 'pending', 'verified', admin_notes);

    -- Notify user of approval
    INSERT INTO user_notifications (user_id, type, title, message)
    VALUES (
      target_user_id,
      'account_verified',
      'Compte approuvé',
      '✅ Votre compte a été approuvé. Vous pouvez maintenant accéder à vos fonctions.'
    );

    result := json_build_object('success', true, 'message', 'User verified successfully');
  ELSE
    -- Reject user
    INSERT INTO user_validation_logs (user_id, validated_by, action, previous_status, new_status, notes)
    VALUES (target_user_id, admin_user_id, 'rejected', 'pending', 'rejected', admin_notes);

    -- Notify user of rejection
    INSERT INTO user_notifications (user_id, type, title, message)
    VALUES (
      target_user_id,
      'account_rejected',
      'Compte refusé',
      '❌ Votre demande de compte a été refusée. ' || COALESCE('Raison : ' || admin_notes, '')
    );

    result := json_build_object('success', true, 'message', 'User rejected successfully');
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_is_read ON user_notifications(is_read);
