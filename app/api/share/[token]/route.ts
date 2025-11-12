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
      .select(`
        *,
        documents:document_id (
          id,
          name,
          file_path,
          file_type,
          file_size
        )
      `)
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

    const document = share.documents as any;

    if (!document) {
      return NextResponse.json(
        { error: 'Document introuvable' },
        { status: 404 }
      );
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(document.file_path);

    if (downloadError || !fileData) {
      console.error('Erreur téléchargement fichier:', downloadError);
      return NextResponse.json(
        { error: 'Fichier introuvable dans le storage' },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());

    const contentType = document.file_type || 'application/octet-stream';
    const fileName = encodeURIComponent(document.name);

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    headers.set('Content-Disposition', `attachment; filename*=UTF-8''${fileName}`);
    headers.set('Content-Length', buffer.length.toString());
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    headers.set('Access-Control-Allow-Origin', '*');

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Erreur API share:', error);
    return NextResponse.json(
      { error: 'Erreur interne du serveur' },
      { status: 500 }
    );
  }
}
