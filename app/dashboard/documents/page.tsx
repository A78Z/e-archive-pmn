'use client';


import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FileText, Search, Folder, FolderPlus, FilePlus, MoreVertical, ChevronRight, ChevronDown, Edit, Download, Share2, Trash2, Plus, Eye, ShieldAlert, Grid3x3, LayoutGrid, Maximize2, Hash } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Textarea } from '@/components/ui/textarea';
import { useUserPreferences } from '@/lib/hooks/use-user-preferences';
import { DISPLAY_MODES, STATUS_COLORS, DisplayMode, categoryColors } from '@/lib/types/documents';
import type { Folder as FolderType, Document as DocumentType } from '@/lib/types/documents';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

type Folder = FolderType;
type Document = DocumentType;

export default function DocumentsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const { displayMode, setDisplayMode } = useUserPreferences(profile?.id);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const [isNewFolderDialogOpen, setIsNewFolderDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isSubFolderDialogOpen, setIsSubFolderDialogOpen] = useState(false);
  const [isEditFolderNumberDialogOpen, setIsEditFolderNumberDialogOpen] = useState(false);

  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [newFolderCategory, setNewFolderCategory] = useState('');
  const [newFolderNumber, setNewFolderNumber] = useState('');
  const [newFolderStatus, setNewFolderStatus] = useState('Archive');
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [renamingItem, setRenamingItem] = useState<{id: string, name: string, type: 'folder' | 'document'} | null>(null);
  const [newName, setNewName] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [permissions, setPermissions] = useState({
    lecture: true,
    ecriture: false,
    suppression: false,
    partage: false,
  });
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isPreviewDialogOpen, setIsPreviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (!profile) return;
    fetchFolders();
    fetchDocuments();
    fetchUsers();
  }, [profile]);

  const fetchFolders = async () => {
    const { data } = await supabase
      .from('folders')
      .select('*')
      .order('created_at', { ascending: false });

    setFolders(data || []);
  };

  const fetchDocuments = async () => {
    const { data } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    setDocuments(data || []);
  };

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('users')
      .select('id, full_name, email')
      .neq('id', profile?.id)
      .order('full_name');

    setUsers(data || []);
  };

  const buildFolderTree = (folders: Folder[], parentId: string | null = null): Folder[] => {
    return folders
      .filter(f => f.parent_id === parentId)
      .map(folder => ({
        ...folder,
        isOpen: expandedFolders.has(folder.id),
        children: buildFolderTree(folders, folder.id),
        documents: documents.filter(d => d.folder_id === folder.id),
      }));
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const createFolder = async () => {
    if (!newFolderName.trim()) {
      toast.error('Veuillez entrer un nom de dossier');
      return;
    }

    if (!newFolderCategory) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newFolder: Folder = {
      id: tempId,
      name: newFolderName,
      parent_id: null,
      category: newFolderCategory,
      folder_number: newFolderNumber || null,
      status: newFolderStatus,
      created_by: profile?.id || '',
      created_at: new Date().toISOString(),
    };

    setFolders(prev => [newFolder, ...prev]);
    setIsNewFolderDialogOpen(false);
    const folderName = newFolderName;
    const folderDesc = newFolderDescription;
    const folderCat = newFolderCategory;
    const folderNum = newFolderNumber;
    const folderStat = newFolderStatus;
    setNewFolderName('');
    setNewFolderDescription('');
    setNewFolderCategory('');
    setNewFolderNumber('');
    setNewFolderStatus('Archive');

    const { data, error } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        description: folderDesc || null,
        category: folderCat,
        folder_number: folderNum || null,
        status: folderStat,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Impossible de créer le dossier');
      setFolders(prev => prev.filter(f => f.id !== tempId));
    } else {
      toast.success('✅ Dossier créé avec succès');
      setFolders(prev => prev.map(f => f.id === tempId ? data : f));
    }
  };

  const createSubFolder = async () => {
    if (!newFolderName.trim() || !selectedFolder) {
      toast.error('Veuillez entrer un nom de dossier');
      return;
    }

    if (!newFolderCategory) {
      toast.error('Veuillez sélectionner une catégorie');
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newSubFolder: Folder = {
      id: tempId,
      name: newFolderName,
      parent_id: selectedFolder.id,
      category: newFolderCategory,
      folder_number: newFolderNumber || null,
      status: newFolderStatus,
      created_by: profile?.id || '',
      created_at: new Date().toISOString(),
    };

    setFolders(prev => [newSubFolder, ...prev]);
    const parentId = selectedFolder.id;
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      newSet.add(parentId);
      return newSet;
    });
    setIsSubFolderDialogOpen(false);
    const folderName = newFolderName;
    const folderDesc = newFolderDescription;
    const folderCat = newFolderCategory;
    const folderNum = newFolderNumber;
    const folderStat = newFolderStatus;
    setNewFolderName('');
    setNewFolderDescription('');
    setNewFolderCategory('');
    setNewFolderNumber('');
    setNewFolderStatus('Archive');
    setSelectedFolder(null);

    const { data, error } = await supabase
      .from('folders')
      .insert({
        name: folderName,
        description: folderDesc || null,
        category: folderCat,
        folder_number: folderNum || null,
        status: folderStat,
        parent_id: parentId,
        created_by: profile?.id,
      })
      .select()
      .single();

    if (error) {
      toast.error('Impossible de créer le sous-dossier');
      setFolders(prev => prev.filter(f => f.id !== tempId));
    } else {
      toast.success('✅ Sous-dossier créé avec succès');
      setFolders(prev => prev.map(f => f.id === tempId ? data : f));
    }
  };

  const renameItem = async () => {
    if (!newName.trim() || !renamingItem) return;

    const table = renamingItem.type === 'folder' ? 'folders' : 'documents';

    if (renamingItem.type === 'folder') {
      setFolders(prev => prev.map(f =>
        f.id === renamingItem.id ? { ...f, name: newName } : f
      ));
    } else {
      setDocuments(prev => prev.map(d =>
        d.id === renamingItem.id ? { ...d, name: newName } : d
      ));
    }

    const { error } = await supabase
      .from(table)
      .update({ name: newName })
      .eq('id', renamingItem.id);

    if (error) {
      toast.error('Impossible de renommer');
      if (renamingItem.type === 'folder') {
        fetchFolders();
      } else {
        fetchDocuments();
      }
    } else {
      toast.success('✅ Renommé avec succès');
    }

    setIsRenameDialogOpen(false);
    setRenamingItem(null);
    setNewName('');
  };

  const updateFolderNumber = async () => {
    if (!selectedFolder) return;

    const { error } = await supabase
      .from('folders')
      .update({
        folder_number: newFolderNumber || null,
        status: newFolderStatus
      })
      .eq('id', selectedFolder.id);

    if (error) {
      toast.error('Impossible de mettre à jour le numéro');
      console.error('Erreur:', error);
    } else {
      toast.success('✅ Numéro mis à jour avec succès');
      setFolders(prev => prev.map(f =>
        f.id === selectedFolder.id
          ? { ...f, folder_number: newFolderNumber || null, status: newFolderStatus }
          : f
      ));
    }

    setIsEditFolderNumberDialogOpen(false);
    setSelectedFolder(null);
    setNewFolderNumber('');
    setNewFolderStatus('Archive');
  };

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce dossier et tout son contenu ?')) return;

    setFolders(prev => prev.filter(f => f.id !== folderId));
    setDocuments(prev => prev.filter(d => d.folder_id !== folderId));

    const { error } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (error) {
      toast.error('Impossible de supprimer le dossier');
      fetchFolders();
      fetchDocuments();
    } else {
      toast.success('🗑️ Dossier supprimé avec succès');
    }
  };

  const deleteDocument = async (docId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    const doc = documents.find(d => d.id === docId);
    setDocuments(prev => prev.filter(d => d.id !== docId));

    if (doc?.file_path) {
      await supabase.storage.from('documents').remove([doc.file_path]);
    }

    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', docId);

    if (error) {
      toast.error('Impossible de supprimer le document');
      fetchDocuments();
    } else {
      toast.success('🗑️ Document supprimé avec succès');
    }
  };

  const downloadDocument = async (doc: Document) => {
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

  const previewDocument = async (doc: Document) => {
    try {
      toast.loading('👁️ Chargement de la prévisualisation...', { id: 'preview' });

      const { data, error } = await supabase.storage
        .from('documents')
        .download(doc.file_path);

      if (error || !data) {
        throw error;
      }

      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
      setSelectedDocument(doc);
      setIsPreviewDialogOpen(true);
      toast.success('👁️ Prévisualisation chargée', { id: 'preview', duration: 2000 });
    } catch (err) {
      console.error('Erreur:', err);
      toast.error('Impossible de prévisualiser le document', { id: 'preview' });
    }
  };

  const shareDocument = (doc: Document) => {
    setSelectedDocument(doc);
    setSelectedUserId('');
    setPermissions({
      lecture: true,
      ecriture: false,
      suppression: false,
      partage: false,
    });
    setIsShareDialogOpen(true);
  };

  const handleShareDocument = async () => {
    if (isSharing) return;

    if (!selectedDocument) {
      toast.error('Aucun document sélectionné');
      return;
    }

    if (!selectedUserId) {
      toast.error('Veuillez sélectionner un utilisateur dans la liste');
      return;
    }

    if (!permissions.lecture && !permissions.ecriture && !permissions.suppression && !permissions.partage) {
      toast.error('Veuillez sélectionner au moins une permission');
      return;
    }

    setIsSharing(true);
    toast.loading('Partage en cours...', { id: 'sharing' });

    try {
      const { data: existingShare } = await supabase
        .from('shares')
        .select('id')
        .eq('document_id', selectedDocument.id)
        .eq('shared_with', selectedUserId)
        .eq('is_link_share', false)
        .maybeSingle();

      if (existingShare) {
        const { error: updateError } = await supabase
          .from('shares')
          .update({
            can_read: permissions.lecture,
            can_write: permissions.ecriture,
            can_delete: permissions.suppression,
            can_share: permissions.partage,
          })
          .eq('id', existingShare.id);

        if (updateError) throw updateError;

        const { data: sharedUser } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', selectedUserId)
          .single();

        toast.success(`✅ Permissions mises à jour avec succès pour ${sharedUser?.full_name}`, { id: 'sharing' });
      } else {
        const { error: insertError } = await supabase.from('shares').insert({
          document_id: selectedDocument.id,
          shared_by: profile?.id,
          shared_with: selectedUserId,
          can_read: permissions.lecture,
          can_write: permissions.ecriture,
          can_delete: permissions.suppression,
          can_share: permissions.partage,
          is_link_share: false,
        });

        if (insertError) throw insertError;

        const { data: sharedUser } = await supabase
          .from('users')
          .select('full_name')
          .eq('id', selectedUserId)
          .single();

        toast.success(`✅ Document partagé avec succès avec ${sharedUser?.full_name}`, { id: 'sharing' });
      }

      setTimeout(() => {
        setIsShareDialogOpen(false);
        setSelectedDocument(null);
        setSelectedUserId('');
        setPermissions({ lecture: true, ecriture: false, suppression: false, partage: false });
        setIsSharing(false);
        window.dispatchEvent(new Event('refreshDashboard'));
      }, 800);
    } catch (error: any) {
      console.error('Erreur lors du partage:', error);
      const errorMessage = error?.message || 'Erreur inconnue';
      toast.error(`Impossible de partager le document: ${errorMessage}`, { id: 'sharing' });
      setIsSharing(false);
    }
  };

  const getAllSubfolders = async (folderId: string): Promise<Folder[]> => {
    const { data: subfolders } = await supabase
      .from('folders')
      .select('*')
      .eq('parent_id', folderId);

    if (!subfolders || subfolders.length === 0) {
      return [];
    }

    let allSubfolders: Folder[] = [...subfolders];

    for (const subfolder of subfolders) {
      const nestedSubfolders = await getAllSubfolders(subfolder.id);
      allSubfolders = [...allSubfolders, ...nestedSubfolders];
    }

    return allSubfolders;
  };

  const downloadFolderAsZip = async (folder: Folder) => {
    toast.loading('📦 Préparation du téléchargement ZIP...', { id: 'zip' });

    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      const allSubfolders = await getAllSubfolders(folder.id);
      const allFolderIds = [folder.id, ...allSubfolders.map(f => f.id)];

      const { data: allDocuments } = await supabase
        .from('documents')
        .select('*')
        .in('folder_id', allFolderIds);

      if (!allDocuments || allDocuments.length === 0) {
        toast.info('Ce dossier est vide. Un ZIP vide sera créé.', { id: 'zip' });
        zip.file('README.txt', 'Ce dossier ne contient aucun fichier.');
      } else {
        const folderPathMap = new Map<string, string>();
        folderPathMap.set(folder.id, '');

        const buildFolderPath = (folderId: string, parentPath: string = ''): string => {
          if (folderPathMap.has(folderId)) {
            return folderPathMap.get(folderId)!;
          }

          const currentFolder = allSubfolders.find(f => f.id === folderId);
          if (!currentFolder) return parentPath;

          const parentFolderId = currentFolder.parent_id;
          if (!parentFolderId || parentFolderId === folder.id) {
            const path = currentFolder.name + '/';
            folderPathMap.set(folderId, path);
            return path;
          }

          const parentFolderPath = buildFolderPath(parentFolderId, parentPath);
          const fullPath = parentFolderPath + currentFolder.name + '/';
          folderPathMap.set(folderId, fullPath);
          return fullPath;
        };

        allSubfolders.forEach(subfolder => {
          buildFolderPath(subfolder.id);
        });

        let downloadedCount = 0;
        let errorCount = 0;

        for (const doc of allDocuments) {
          try {
            const { data, error } = await supabase.storage
              .from('documents')
              .download(doc.file_path);

            if (data && !error) {
              const folderPath = folderPathMap.get(doc.folder_id) || '';
              const filePath = folderPath + doc.name;
              zip.file(filePath, data);
              downloadedCount++;
            } else {
              errorCount++;
              console.error('Erreur lors du téléchargement de', doc.name, error);
            }
          } catch (err) {
            errorCount++;
            console.error('Erreur lors du téléchargement de', doc.name, err);
          }
        }

        if (downloadedCount === 0) {
          toast.error('Impossible de télécharger les fichiers du dossier', { id: 'zip' });
          return;
        }

        if (errorCount > 0) {
          toast.warning(`⚠️ ${downloadedCount} fichiers téléchargés, ${errorCount} erreurs`, { id: 'zip' });
        }
      }

      const content = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });

      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${folder.name}.zip`;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);

      toast.success(`✅ Téléchargement du ZIP terminé : ${folder.name}.zip`, {
        id: 'zip',
        duration: 5000
      });
    } catch (error) {
      console.error('Erreur:', error);
      toast.error('Impossible de créer le fichier ZIP', { id: 'zip' });
    }
  };

  const shareFolder = (folder: Folder) => {
    setSelectedFolder(folder);
    setSelectedUserId('');
    setPermissions({
      lecture: true,
      ecriture: false,
      suppression: false,
      partage: false,
    });
    setIsShareDialogOpen(true);
  };

  const handleShareFolder = async () => {
    if (isSharing) return;

    if (!selectedFolder) {
      toast.error('Aucun dossier sélectionné');
      return;
    }

    if (!selectedUserId) {
      toast.error('Veuillez sélectionner un utilisateur dans la liste');
      return;
    }

    if (!permissions.lecture && !permissions.ecriture && !permissions.suppression && !permissions.partage) {
      toast.error('Veuillez sélectionner au moins une permission');
      return;
    }

    setIsSharing(true);
    toast.loading('Partage du dossier en cours...', { id: 'sharingFolder' });

    try {
      const allSubfolders = await getAllSubfolders(selectedFolder.id);
      const allFolderIds = [selectedFolder.id, ...allSubfolders.map(f => f.id)];

      const { data: allFolderDocs } = await supabase
        .from('documents')
        .select('*')
        .in('folder_id', allFolderIds);

      if (!allFolderDocs || allFolderDocs.length === 0) {
        toast.info('Ce dossier ne contient aucun document à partager', { id: 'sharingFolder' });
        setTimeout(() => {
          setIsShareDialogOpen(false);
          setIsSharing(false);
        }, 800);
        return;
      }

      const sharePromises = allFolderDocs.map(doc =>
        supabase.from('shares').insert({
          document_id: doc.id,
          shared_by: profile?.id,
          shared_with: selectedUserId,
          can_read: permissions.lecture,
          can_write: permissions.ecriture,
          can_delete: permissions.suppression,
          can_share: permissions.partage,
          is_link_share: false,
        })
      );

      const results = await Promise.all(sharePromises);
      const errors = results.filter(r => r.error);

      const { data: sharedUser } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', selectedUserId)
        .single();

      if (errors.length > 0) {
        console.error('Erreurs de partage:', errors);
        const successCount = allFolderDocs.length - errors.length;
        if (successCount > 0) {
          toast.warning(
            `⚠️ Partage partiel : ${successCount}/${allFolderDocs.length} documents partagés avec ${sharedUser?.full_name}`,
            { id: 'sharingFolder' }
          );
        } else {
          toast.error('Impossible de partager les documents du dossier', { id: 'sharingFolder' });
        }
      } else {
        toast.success(
          `✅ Dossier partagé avec succès avec ${sharedUser?.full_name} (${allFolderDocs.length} document${allFolderDocs.length > 1 ? 's' : ''})`,
          { id: 'sharingFolder' }
        );
      }

      setTimeout(() => {
        setIsShareDialogOpen(false);
        setSelectedFolder(null);
        setSelectedUserId('');
        setPermissions({ lecture: true, ecriture: false, suppression: false, partage: false });
        setIsSharing(false);
        window.dispatchEvent(new Event('refreshDashboard'));
      }, 800);
    } catch (error: any) {
      console.error('Erreur lors du partage du dossier:', error);
      const errorMessage = error?.message || 'Erreur inconnue';
      toast.error(`Impossible de partager le dossier: ${errorMessage}`, { id: 'sharingFolder' });
      setIsSharing(false);
    }
  };

  const generateShareLink = async () => {
    if (isSharing) return;

    if (!selectedFolder && !selectedDocument) {
      toast.error('Aucun élément sélectionné pour partager');
      return;
    }

    if (!permissions.lecture && !permissions.ecriture && !permissions.suppression && !permissions.partage) {
      toast.error('Veuillez sélectionner au moins une permission');
      return;
    }

    setIsSharing(true);
    toast.loading('🔗 Génération du lien de partage...', { id: 'generateLink' });

    try {
      let documentsToShare: Document[] = [];

      if (selectedDocument) {
        documentsToShare = [selectedDocument];
      } else if (selectedFolder) {
        const allSubfolders = await getAllSubfolders(selectedFolder.id);
        const allFolderIds = [selectedFolder.id, ...allSubfolders.map(f => f.id)];

        const { data: allFolderDocs, error: fetchError } = await supabase
          .from('documents')
          .select('*')
          .in('folder_id', allFolderIds);

        if (fetchError) throw fetchError;

        if (!allFolderDocs || allFolderDocs.length === 0) {
          toast.info('Ce dossier ne contient aucun document à partager', { id: 'generateLink' });
          setIsSharing(false);
          return;
        }

        documentsToShare = allFolderDocs;
      }

      const documentIds = documentsToShare.map(doc => doc.id);

      const { data: existingShares } = await supabase
        .from('shares')
        .select('share_token, document_id')
        .in('document_id', documentIds)
        .eq('is_link_share', true)
        .eq('shared_by', profile?.id);

      let shareToken: string;

      if (existingShares && existingShares.length > 0) {
        shareToken = existingShares[0].share_token!;
        const existingDocIds = existingShares.map(s => s.document_id);
        const newDocIds = documentIds.filter(id => !existingDocIds.includes(id));

        if (newDocIds.length > 0) {
          const newShares = newDocIds.map(docId => ({
            document_id: docId,
            shared_by: profile?.id,
            shared_with: null,
            can_read: permissions.lecture,
            can_write: permissions.ecriture,
            can_delete: permissions.suppression,
            can_share: permissions.partage,
            is_link_share: true,
            share_token: shareToken,
            expires_at: null,
          }));

          const { error: insertError } = await supabase
            .from('shares')
            .insert(newShares);

          if (insertError) throw insertError;
        }

        const { error: updateError } = await supabase
          .from('shares')
          .update({
            can_read: permissions.lecture,
            can_write: permissions.ecriture,
            can_delete: permissions.suppression,
            can_share: permissions.partage,
          })
          .eq('share_token', shareToken);

        if (updateError) throw updateError;
      } else {
        shareToken = crypto.randomUUID();

        const sharesToInsert = documentsToShare.map(doc => ({
          document_id: doc.id,
          shared_by: profile?.id,
          shared_with: null,
          can_read: permissions.lecture,
          can_write: permissions.ecriture,
          can_delete: permissions.suppression,
          can_share: permissions.partage,
          is_link_share: true,
          share_token: shareToken,
          expires_at: null,
        }));

        const { error: insertError } = await supabase
          .from('shares')
          .insert(sharesToInsert);

        if (insertError) {
          console.error('Erreur génération lien:', insertError);
          throw insertError;
        }
      }

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

      const isDirectDownload = documentsToShare.length === 1;
      const shareLink = isDirectDownload
        ? `${appUrl}/api/share/${shareToken}`
        : `${appUrl}/shared?token=${shareToken}`;

      try {
        await navigator.clipboard.writeText(shareLink);

        if (isDirectDownload) {
          toast.success(
            `🔗 Lien de téléchargement généré et copié !`,
            {
              id: 'generateLink',
              description: `📥 Ce lien permet de télécharger directement : ${documentsToShare[0].name}`,
              duration: 6000
            }
          );
        } else {
          toast.success(
            `🔗 Lien de partage généré et copié !`,
            {
              id: 'generateLink',
              description: `📦 Ce lien permet d'afficher ou télécharger les ${documentsToShare.length} documents partagés`,
              duration: 6000
            }
          );
        }
      } catch (clipboardError) {
        console.error('Erreur copie presse-papier:', clipboardError);
        toast.success(
          `🔗 Lien généré avec succès`,
          {
            id: 'generateLink',
            description: shareLink,
            duration: 10000
          }
        );
      }

      setIsSharing(false);
      window.dispatchEvent(new Event('refreshDashboard'));
    } catch (error: any) {
      console.error('Erreur lors de la génération du lien:', error);
      const errorMessage = error?.message || 'Erreur inconnue';
      toast.error(`Impossible de générer le lien: ${errorMessage}`, { id: 'generateLink' });
      setIsSharing(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const folderTree = buildFolderTree(folders);
  const rootDocuments = documents.filter(d => d.folder_id === null);

  const filterBySearch = (items: any[]) => {
    if (!searchTerm.trim()) return items;
    const term = searchTerm.toLowerCase();
    return items.filter(item =>
      item.name?.toLowerCase().includes(term) ||
      item.folder_number?.toLowerCase().includes(term) ||
      item.description?.toLowerCase().includes(term)
    );
  };

  const filteredTree = filterBySearch(
    categoryFilter === 'all'
      ? folderTree
      : folderTree.filter(f => f.category === categoryFilter)
  );

  const filteredRootDocuments = filterBySearch(
    categoryFilter === 'all'
      ? rootDocuments
      : rootDocuments.filter(d => d.category === categoryFilter)
  );

  const renderFolder = (folder: Folder, level: number = 0) => {
    const hasChildren = (folder.children && folder.children.length > 0) || (folder.documents && folder.documents.length > 0);
    const childCount = (folder.children?.length || 0) + (folder.documents?.length || 0);
    const iconSize = DISPLAY_MODES[displayMode].size;
    const padding = displayMode === 'very_large' ? 'p-4' : displayMode === 'large' ? 'p-3' : 'p-2';

    return (
      <div key={folder.id} className="mb-2">
        <div className={`flex items-center gap-2 ${padding} rounded-lg border bg-white hover:bg-gray-50 transition-colors`} style={{ marginLeft: `${level * 24}px` }}>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 p-0"
            onClick={() => toggleFolder(folder.id)}
          >
            {hasChildren ? (
              folder.isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <div className="h-4 w-4" />
            )}
          </Button>

          <Folder className="text-blue-500" style={{ width: `${iconSize}px`, height: `${iconSize}px` }} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {folder.folder_number && (
                <Badge variant="outline" className="text-xs font-mono bg-gray-100">
                  <Hash className="h-3 w-3 mr-1" />
                  {folder.folder_number}
                </Badge>
              )}
              <p className="font-semibold text-sm">{folder.name}</p>
              <Badge className={`text-xs ${categoryColors[folder.category] || 'bg-gray-100 text-gray-800'}`}>
                {folder.category}
              </Badge>
              {folder.status && STATUS_COLORS[folder.status as keyof typeof STATUS_COLORS] && (
                <Badge className={`text-xs ${STATUS_COLORS[folder.status as keyof typeof STATUS_COLORS].bg} ${STATUS_COLORS[folder.status as keyof typeof STATUS_COLORS].text}`}>
                  {STATUS_COLORS[folder.status as keyof typeof STATUS_COLORS].dot} {folder.status}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{formatDate(folder.created_at)}</p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => {
                setRenamingItem({ id: folder.id, name: folder.name, type: 'folder' });
                setNewName(folder.name);
                setIsRenameDialogOpen(true);
              }}>
                <Edit className="mr-2 h-4 w-4" />
                Renommer
              </DropdownMenuItem>
              {profile?.role === 'super_admin' && (
                <DropdownMenuItem onClick={() => {
                  setSelectedFolder(folder);
                  setNewFolderNumber(folder.folder_number || '');
                  setNewFolderStatus(folder.status || 'Archive');
                  setIsEditFolderNumberDialogOpen(true);
                }}>
                  <Hash className="mr-2 h-4 w-4" />
                  Modifier le numéro
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => downloadFolderAsZip(folder)}>
                <Download className="mr-2 h-4 w-4" />
                Télécharger ZIP
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => shareFolder(folder)}>
                <Share2 className="mr-2 h-4 w-4" />
                Partager dossier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => {
                setSelectedFolder(folder);
                setIsSubFolderDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                Nouveau sous-dossier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => deleteFolder(folder.id)} className="text-red-600">
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {folder.isOpen && (
          <div className="mt-2">
            {folder.children && folder.children.map(child => renderFolder(child, level + 1))}
            {folder.documents && folder.documents.map(doc => (
              <div key={doc.id} className={`flex items-center gap-2 p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors mb-2`} style={{ marginLeft: `${(level + 1) * 24 + 32}px` }}>
                <FileText className="h-5 w-5 text-gray-600" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{doc.name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p>
                </div>
                <Badge className={`text-xs ${categoryColors[doc.category] || 'bg-gray-100 text-gray-800'}`}>
                  {doc.category}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => {
                      setRenamingItem({ id: doc.id, name: doc.name, type: 'document' });
                      setNewName(doc.name);
                      setIsRenameDialogOpen(true);
                    }}>
                      <Edit className="mr-2 h-4 w-4" />
                      Renommer
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => previewDocument(doc)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Prévisualiser
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => shareDocument(doc)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Partager
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push(`/dashboard/access-requests?document_id=${doc.id}`)} className="text-purple-600 focus:text-purple-600">
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      Demander l'accès
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => deleteDocument(doc.id)} className="text-red-600 focus:text-red-600">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Mes Documents</h1>
          <p className="text-muted-foreground mt-1">Gérez vos documents et métadonnées</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Rechercher des documents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Card className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-2">Arborescence des Documents</h2>
          <p className="text-sm text-muted-foreground mb-4">Organisez vos documents en dossiers et sous-dossiers</p>

          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Toutes catégories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes catégories</SelectItem>
                <SelectItem value="Administrative">Administrative</SelectItem>
                <SelectItem value="Technique">Technique</SelectItem>
                <SelectItem value="Financière">Financière</SelectItem>
                <SelectItem value="Légale">Légale</SelectItem>
                <SelectItem value="Projet">Projet</SelectItem>
                <SelectItem value="Formation">Formation</SelectItem>
                <SelectItem value="Communication">Communication</SelectItem>
                <SelectItem value="Archive">Archive</SelectItem>
              </SelectContent>
            </Select>

            <Select value={displayMode} onValueChange={(value: DisplayMode) => setDisplayMode(value)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Taille d'affichage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="very_large">
                  <div className="flex items-center gap-2">
                    <Maximize2 className="h-4 w-4" />
                    <span>Très grandes icônes</span>
                  </div>
                </SelectItem>
                <SelectItem value="large">
                  <div className="flex items-center gap-2">
                    <LayoutGrid className="h-4 w-4" />
                    <span>Grandes icônes</span>
                  </div>
                </SelectItem>
                <SelectItem value="medium">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="h-4 w-4" />
                    <span>Icônes moyennes</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => setIsNewFolderDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <FolderPlus className="mr-2 h-4 w-4" />
              Nouveau dossier
            </Button>

            <Button onClick={() => router.push('/dashboard/upload')} className="bg-blue-600 hover:bg-blue-700 transition-all duration-200">
              <FilePlus className="mr-2 h-4 w-4" />
              Nouveau document
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {filteredTree.map(folder => renderFolder(folder))}
          {filteredRootDocuments.map(doc => (
            <div key={doc.id} className="flex items-center gap-2 p-3 rounded-lg border bg-gray-50 hover:bg-gray-100 transition-colors">
              <FileText className="h-5 w-5 text-gray-600" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{doc.name}</p>
                <p className="text-xs text-muted-foreground">{formatDate(doc.created_at)}</p>
              </div>
              <Badge className={`text-xs ${categoryColors[doc.category] || 'bg-gray-100 text-gray-800'}`}>
                {doc.category}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => {
                    setRenamingItem({ id: doc.id, name: doc.name, type: 'document' });
                    setNewName(doc.name);
                    setIsRenameDialogOpen(true);
                  }}>
                    <Edit className="mr-2 h-4 w-4" />
                    Renommer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => downloadDocument(doc)}>
                    <Download className="mr-2 h-4 w-4" />
                    Télécharger
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => previewDocument(doc)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Prévisualiser
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => shareDocument(doc)}>
                    <Share2 className="mr-2 h-4 w-4" />
                    Partager
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/dashboard/access-requests?document_id=${doc.id}`)} className="text-purple-600 focus:text-purple-600">
                    <ShieldAlert className="mr-2 h-4 w-4" />
                    Demander l'accès
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => deleteDocument(doc.id)} className="text-red-600 focus:text-red-600">
                    <Trash2 className="mr-2 h-4 w-4" />
                    Supprimer
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
        </div>
      </Card>

      <Dialog open={isNewFolderDialogOpen} onOpenChange={setIsNewFolderDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Créer un nouveau dossier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folderName">Nom du dossier</Label>
              <Input
                id="folderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nom du dossier"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folderDescription">Description (optionnelle)</Label>
              <Textarea
                id="folderDescription"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Description du dossier"
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="folderCategory">Catégorie *</Label>
              <Select value={newFolderCategory} onValueChange={setNewFolderCategory}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrative">Administrative</SelectItem>
                  <SelectItem value="Technique">Technique</SelectItem>
                  <SelectItem value="Financière">Financière</SelectItem>
                  <SelectItem value="Légale">Légale</SelectItem>
                  <SelectItem value="Projet">Projet</SelectItem>
                  <SelectItem value="Formation">Formation</SelectItem>
                  <SelectItem value="Communication">Communication</SelectItem>
                  <SelectItem value="Archive">Archive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {profile?.role === 'super_admin' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="folderNumber">Numéro de dossier (optionnel)</Label>
                  <Input
                    id="folderNumber"
                    value={newFolderNumber}
                    onChange={(e) => setNewFolderNumber(e.target.value)}
                    placeholder="Ex: D-001, CAISSE-12-D04, A-2025-001"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">Référence physique du dossier dans les archives</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="folderStatus">Statut</Label>
                  <Select value={newFolderStatus} onValueChange={setNewFolderStatus}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Archive">🔴 Archive</SelectItem>
                      <SelectItem value="En cours">🟡 En cours</SelectItem>
                      <SelectItem value="Nouveau">🟢 Nouveau</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsNewFolderDialogOpen(false)} className="h-11">Annuler</Button>
            <Button onClick={createFolder} className="h-11 bg-green-700 hover:bg-green-800">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isSubFolderDialogOpen} onOpenChange={setIsSubFolderDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Créer un sous-dossier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subFolderName">Nom du sous-dossier</Label>
              <Input
                id="subFolderName"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Nom du dossier"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subFolderDescription">Description (optionnelle)</Label>
              <Textarea
                id="subFolderDescription"
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                placeholder="Description du dossier"
                rows={4}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subFolderCategory">Catégorie *</Label>
              <Select value={newFolderCategory} onValueChange={setNewFolderCategory}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Sélectionner une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Administrative">Administrative</SelectItem>
                  <SelectItem value="Technique">Technique</SelectItem>
                  <SelectItem value="Financière">Financière</SelectItem>
                  <SelectItem value="Légale">Légale</SelectItem>
                  <SelectItem value="Projet">Projet</SelectItem>
                  <SelectItem value="Formation">Formation</SelectItem>
                  <SelectItem value="Communication">Communication</SelectItem>
                  <SelectItem value="Archive">Archive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {profile?.role === 'super_admin' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="subFolderNumber">Numéro de dossier (optionnel)</Label>
                  <Input
                    id="subFolderNumber"
                    value={newFolderNumber}
                    onChange={(e) => setNewFolderNumber(e.target.value)}
                    placeholder="Ex: D-001, CAISSE-12-D04, A-2025-001"
                    className="h-11"
                  />
                  <p className="text-xs text-muted-foreground">Référence physique du dossier dans les archives</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subFolderStatus">Statut</Label>
                  <Select value={newFolderStatus} onValueChange={setNewFolderStatus}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Archive">🔴 Archive</SelectItem>
                      <SelectItem value="En cours">🟡 En cours</SelectItem>
                      <SelectItem value="Nouveau">🟢 Nouveau</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsSubFolderDialogOpen(false)} className="h-11">Annuler</Button>
            <Button onClick={createSubFolder} className="h-11 bg-green-700 hover:bg-green-800">Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditFolderNumberDialogOpen} onOpenChange={setIsEditFolderNumberDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier le numéro du dossier</DialogTitle>
            <DialogDescription>
              Attribuer ou modifier la référence physique du dossier
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editFolderNumber">Numéro de dossier</Label>
              <Input
                id="editFolderNumber"
                value={newFolderNumber}
                onChange={(e) => setNewFolderNumber(e.target.value)}
                placeholder="Ex: D-001, CAISSE-12-D04, A-2025-001"
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                Référence physique du dossier dans les cartons d'archives
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="editFolderStatus">Statut</Label>
              <Select value={newFolderStatus} onValueChange={setNewFolderStatus}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Sélectionner un statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Archive">🔴 Archive</SelectItem>
                  <SelectItem value="En cours">🟡 En cours</SelectItem>
                  <SelectItem value="Nouveau">🟢 Nouveau</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsEditFolderNumberDialogOpen(false)} className="h-11">
              Annuler
            </Button>
            <Button onClick={updateFolderNumber} className="h-11 bg-green-700 hover:bg-green-800">
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer</DialogTitle>
            <DialogDescription>Modifier le nom de cet élément</DialogDescription>
          </DialogHeader>
          <div>
            <Label htmlFor="newName">Nouveau nom</Label>
            <Input
              id="newName"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Entrez le nouveau nom"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>Annuler</Button>
            <Button onClick={renameItem}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isShareDialogOpen} onOpenChange={(open) => {
        if (isSharing) return;
        setIsShareDialogOpen(open);
        if (!open) {
          setSelectedDocument(null);
          setSelectedFolder(null);
        }
      }}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-semibold">
              {selectedDocument ? `Partager: ${selectedDocument.name}` : selectedFolder ? `Partager: ${selectedFolder.name}` : 'Partager le document'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            <div className="space-y-2">
              <Label htmlFor="shareUser" className="text-sm font-normal text-gray-900">
                Partager avec
              </Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="w-full h-10 bg-white">
                  <SelectValue placeholder="Sélectionner un utilisateur" />
                </SelectTrigger>
                <SelectContent>
                  {users.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.full_name} ({user.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-normal text-gray-900">Permissions</Label>
              <div className="space-y-2.5">
                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="lecture"
                    checked={permissions.lecture}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, lecture: checked as boolean }))}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <Label htmlFor="lecture" className="text-sm font-normal cursor-pointer leading-none text-gray-900">
                    Lecture
                  </Label>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="ecriture"
                    checked={permissions.ecriture}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, ecriture: checked as boolean }))}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <Label htmlFor="ecriture" className="text-sm font-normal cursor-pointer leading-none text-gray-900">
                    Écriture
                  </Label>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="suppression"
                    checked={permissions.suppression}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, suppression: checked as boolean }))}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <Label htmlFor="suppression" className="text-sm font-normal cursor-pointer leading-none text-gray-900">
                    Suppression
                  </Label>
                </div>

                <div className="flex items-center space-x-2.5">
                  <Checkbox
                    id="partage"
                    checked={permissions.partage}
                    onCheckedChange={(checked) => setPermissions(prev => ({ ...prev, partage: checked as boolean }))}
                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                  />
                  <Label htmlFor="partage" className="text-sm font-normal cursor-pointer leading-none text-gray-900">
                    Partage
                  </Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-row justify-between items-center gap-3 pt-4 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              onClick={generateShareLink}
              disabled={isSharing}
              className="flex items-center gap-2 h-10 px-4 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Share2 className="h-4 w-4" />
              <span>{isSharing ? 'Génération...' : 'Ou générer un lien'}</span>
            </Button>
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (!isSharing) {
                    setIsShareDialogOpen(false);
                  }
                }}
                disabled={isSharing}
                className="h-10 px-6 border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Annuler
              </Button>
              <Button
                type="button"
                onClick={selectedDocument ? handleShareDocument : handleShareFolder}
                disabled={isSharing}
                className="h-10 px-6 bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSharing ? 'Partage en cours...' : 'Partager'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPreviewDialogOpen} onOpenChange={(open) => {
        if (!open) {
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
          setSelectedDocument(null);
          toast.dismiss('preview');
        }
        setIsPreviewDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-4">
            {previewUrl && selectedDocument && (
              <>
                {selectedDocument.file_type.startsWith('image/') ? (
                  <img
                    src={previewUrl}
                    alt={selectedDocument.name}
                    className="w-full h-auto rounded-lg"
                  />
                ) : selectedDocument.file_type === 'application/pdf' ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[600px] rounded-lg border"
                    title={selectedDocument.name}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      La prévisualisation n'est pas disponible pour ce type de fichier.
                    </p>
                    <Button onClick={() => downloadDocument(selectedDocument)}>
                      <Download className="mr-2 h-4 w-4" />
                      Télécharger le fichier
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
