import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;

    if (!token) {
      return NextResponse.json(
        { error: 'Token manquant' },
        { status: 400 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: shares, error: sharesError } = await supabase
      .from('shares')
      .select('*')
      .eq('share_token', token)
      .eq('is_link_share', true);

    if (sharesError || !shares || shares.length === 0) {
      return NextResponse.json(
        { error: 'Lien de partage invalide ou expiré' },
        { status: 404 }
      );
    }

    const share = shares[0];

    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Ce lien de partage a expiré' },
        { status: 410 }
      );
    }

    if (!share.can_read) {
      return NextResponse.json(
        { error: 'Permission de lecture refusée' },
        { status: 403 }
      );
    }

    const documentIds = shares.map(s => s.document_id);

    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('*')
      .in('id', documentIds);

    if (docsError || !documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'Documents introuvables' },
        { status: 404 }
      );
    }

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    for (const doc of documents) {
      try {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(doc.file_path);

        if (!downloadError && fileData) {
          const arrayBuffer = await fileData.arrayBuffer();
          zip.file(doc.name, arrayBuffer);
        }
      } catch (err) {
        console.error('Erreur téléchargement fichier:', doc.name, err);
      }
    }

    const zipContent = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const headers = new Headers();
    headers.set('Content-Type', 'application/zip');
    headers.set('Content-Disposition', `attachment; filename="documents-partages.zip"`);
    headers.set('Content-Length', zipContent.length.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');

    return new NextResponse(zipContent, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Erreur API share-folder:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
