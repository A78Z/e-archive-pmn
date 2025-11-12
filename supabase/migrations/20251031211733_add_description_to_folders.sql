/*
  # Add Description Column to Folders

  1. Changes
    - Add optional `description` column to folders table
  
  2. Notes
    - This allows users to add descriptions to their folders
*/

ALTER TABLE folders ADD COLUMN IF NOT EXISTS description TEXT;
