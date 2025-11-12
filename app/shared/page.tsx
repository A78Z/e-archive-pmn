'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface SharedDocument {
  id: string;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  description: string;
  category: string;
  created_at: string;
}

interface SharePermissions {
  can_read: boolean;
  can_write: boolean;
  can_delete: boolean;
  can_share: boolean;
}

export default function SharedDocumentsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [permissions, setPermissions] = useState<SharePermissions>({
    can_read: false,
    can_write: false,
    can_delete: false,
    can_share: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      fetchSharedDocuments();
    } else {
      setError('Token de partage manquant');
      setLoading(false);
    }
  }, [token]);

  const fetchSharedDocuments = async () => {
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      const { data: shares, error: sharesError } = await supabase
        .from('shares')
        .select('document_id, can_read, can_write, can_delete, can_share, expires_at')
        .eq('share_token', token)
        .eq('is_link_share', true);

      if (sharesError) throw sharesError;

      if (!shares || shares.length === 0) {
        setError('Lien de partage invalide ou expiré');
        setLoading(false);
        return;
      }

      const firstShare = shares[0];

      if (firstShare.expires_at && new Date(firstShare.expires_at) < new Date()) {
        setError('Ce lien de partage a expiré');
        setLoading(false);
        return;
      }

      setPermissions({
        can_read: firstShare.can_read,
        can_write: firstShare.can_write,
        can_delete: firstShare.can_delete,
        can_share: firstShare.can_share,
      });

      const documentIds = shares.map(s => s.document_id);

      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('*')
        .in('id', documentIds);

      if (docsError) throw docsError;

      setDocuments(docs || []);
      setLoading(false);
    } catch (err) {
      console.error('Erreur:', err);
      setError('Impossible de charger les documents partagés');
      setLoading(false);
    }
  };

  const downloadDocument = async (doc: SharedDocument) => {
    if (!permissions.can_read) {
      toast.error('Vous n\'avez pas la permission de télécharger');
      return;
    }

    try {
      toast.loading(`📥 Téléchargement de ${doc.name}...`, { id: 'download' });

      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (error) {
        console.error('Erreur Supabase Storage:', error);
        throw new Error(`Erreur de téléchargement: ${error.message}`);
      }

      if (!data) {
        throw new Error('Aucune donnée reçue du serveur');
      }

      const blob = new Blob([data], { type: doc.file_type || 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.name;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      toast.success(`✅ Fichier téléchargé avec succès : ${doc.name}`, {
        id: 'download',
        duration: 5000
      });
    } catch (err: any) {
      console.error('Erreur téléchargement:', err);
      const errorMessage = err?.message || 'Erreur inconnue';
      toast.error(`⚠️ Impossible de télécharger le fichier : ${errorMessage}`, {
        id: 'download',
        duration: 6000
      });
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Chargement des documents partagés...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Accès refusé</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={() => router.push('/login')} className="bg-blue-600 hover:bg-blue-700">
            Retour à la connexion
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documents Partagés</h1>
          <p className="text-gray-600">
            {documents.length} document{documents.length > 1 ? 's' : ''} partagé{documents.length > 1 ? 's' : ''} avec vous
          </p>
          <div className="mt-4 flex gap-2 flex-wrap">
            {permissions.can_read && (
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
                Lecture
              </span>
            )}
            {permissions.can_write && (
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                Écriture
              </span>
            )}
            {permissions.can_delete && (
              <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                Suppression
              </span>
            )}
            {permissions.can_share && (
              <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">
                Partage
              </span>
            )}
          </div>
        </div>

        {documents.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Aucun document disponible</p>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc) => (
              <Card key={doc.id} className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate mb-1">{doc.name}</h3>
                    <p className="text-sm text-gray-500 mb-1">{doc.file_type}</p>
                    <p className="text-sm text-gray-500 mb-1">{formatFileSize(doc.file_size)}</p>
                    {doc.description && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{doc.description}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-2">
                      Ajouté le {formatDate(doc.created_at)}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => downloadDocument(doc)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                    size="sm"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Télécharger
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 text-center">
          <Button
            variant="outline"
            onClick={() => router.push('/login')}
            className="border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Se connecter à Archive PMN
          </Button>
        </div>
      </div>
    </div>
  );
}
