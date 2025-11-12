/*
  # Reset Super Admin Password for Harouna SYLLA

  1. Actions
    - Update auth.users password for harouna.sylla@pmn.sn
    - Ensure user is email confirmed
    - Update public.users to set is_verified = true
    - Set verified_at timestamp

  2. Security
    - This is a one-time administrative action
    - Password: My@dmin-pmn (hashed automatically by Supabase)
*/

-- Update the auth.users table to reset password and confirm email
DO $$
DECLARE
  user_id_var uuid;
BEGIN
  -- Get the user ID from auth.users
  SELECT id INTO user_id_var
  FROM auth.users
  WHERE email = 'harouna.sylla@pmn.sn';

  IF user_id_var IS NOT NULL THEN
    -- Update password using crypt function (Supabase's password hashing)
    UPDATE auth.users
    SET
      encrypted_password = crypt('My@dmin-pmn', gen_salt('bf')),
      email_confirmed_at = COALESCE(email_confirmed_at, now()),
      updated_at = now()
    WHERE id = user_id_var;

    -- Update public.users to ensure verification status
    UPDATE users
    SET
      is_verified = true,
      is_active = true,
      verified_at = now(),
      updated_at = now()
    WHERE id = user_id_var;

    RAISE NOTICE 'Super Admin account updated successfully for harouna.sylla@pmn.sn';
  ELSE
    RAISE NOTICE 'User not found in auth.users. Please create the account first via signup.';
  END IF;
END $$;
