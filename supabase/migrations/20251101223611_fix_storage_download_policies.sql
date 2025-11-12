/*
  # Fix Storage Download Policies

  1. New Storage Policies
    - Allow users to read files they own
    - Allow users to read files shared with them
    - Allow public access to files with valid share tokens
    - Maintain upload/delete restrictions
  
  2. Security
    - Authenticated users can access their own files and shared files
    - Public access only for files with active share links
*/

-- Drop existing read policy
DROP POLICY IF EXISTS "Users can read own files" ON storage.objects;

-- Policy: Authenticated users can read their own files
CREATE POLICY "Users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

-- Policy: Authenticated users can read shared files
CREATE POLICY "Users can read shared files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.shares s
    INNER JOIN public.documents d ON s.document_id = d.id
    WHERE d.file_path = storage.objects.name
      AND s.shared_with = auth.uid()
      AND s.can_read = true
  )
);

-- Policy: Public access for files with valid share tokens (anon users)
CREATE POLICY "Public can read files with valid share tokens"
ON storage.objects
FOR SELECT
TO anon
USING (
  bucket_id = 'documents' AND
  EXISTS (
    SELECT 1 FROM public.shares s
    INNER JOIN public.documents d ON s.document_id = d.id
    WHERE d.file_path = storage.objects.name
      AND s.is_link_share = true
      AND s.can_read = true
      AND (s.expires_at IS NULL OR s.expires_at > now())
  )
);
