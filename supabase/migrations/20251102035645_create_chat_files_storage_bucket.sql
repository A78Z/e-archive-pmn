/*
  # Création du bucket de stockage pour les fichiers de chat

  ## 1. Bucket créé
    - `chat_files` : Stockage des fichiers partagés dans les messages
      - Public: false (fichiers privés)
      - Limites de taille configurées

  ## 2. Policies de stockage
    - Les utilisateurs peuvent uploader leurs propres fichiers
    - Les utilisateurs peuvent télécharger les fichiers des conversations auxquelles ils participent
    - Super admin peut accéder à tous les fichiers

  ## 3. Sécurité
    - Fichiers privés par défaut
    - Accès contrôlé par RLS
*/

-- Créer le bucket pour les fichiers de chat
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat_files',
  'chat_files',
  false,
  52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/csv']
)
ON CONFLICT (id) DO NOTHING;

-- Policy pour uploader des fichiers
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat_files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy pour voir ses propres fichiers
DROP POLICY IF EXISTS "Users can view their chat files" ON storage.objects;
CREATE POLICY "Users can view their chat files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat_files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  )
);

-- Policy pour télécharger les fichiers
DROP POLICY IF EXISTS "Users can download chat files" ON storage.objects;
CREATE POLICY "Users can download chat files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat_files'
);

-- Policy pour supprimer ses propres fichiers
DROP POLICY IF EXISTS "Users can delete their chat files" ON storage.objects;
CREATE POLICY "Users can delete their chat files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'chat_files'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('super_admin', 'admin')
    )
  )
);
