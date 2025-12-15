import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  try {
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host || '';
    const url = `${protocol}://${host}${req.url || '/api/upload-csv'}`;
    
    let body: HandleUploadBody;
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch {
        body = req.body as any;
      }
    } else {
      body = req.body as HandleUploadBody;
    }
    
    const requestInit: RequestInit = {
      method: req.method,
      headers: req.headers as HeadersInit,
    };
    
    if (body) {
      requestInit.body = JSON.stringify(body);
    }
    
    const request = new Request(url, requestInit);

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let kind: string | undefined;
        try {
          const payload = typeof clientPayload === 'string'
            ? JSON.parse(clientPayload)
            : clientPayload;
          kind = payload?.kind;
        } catch {
          const match = pathname.match(/(master|start|finish|checkpoint)-/);
          kind = match ? match[1] : undefined;
        }
        
        if (!kind) {
          throw new Error('Parameter kind tidak ditemukan di clientPayload');
        }

        const validKinds = ['master', 'start', 'finish', 'checkpoint'];
        if (!validKinds.includes(kind)) {
          throw new Error(`Jenis CSV tidak valid: ${kind}. Harus salah satu dari: ${validKinds.join(', ')}`);
        }

        return {
          allowedContentTypes: ['text/csv', 'application/csv', 'text/plain'],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            kind,
            uploadedAt: Date.now(),
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('CSV upload completed', blob.url, tokenPayload);

        try {
          const { kind } = JSON.parse(tokenPayload || '{}');
          
          console.log(`CSV ${kind} uploaded successfully:`, blob.url);
        } catch (error) {
          console.error('Error processing upload completion:', error);
        }
      },
    });

    return res.status(200).json(jsonResponse);
  } catch (error: any) {
    console.error('Upload error:', error);
    return res.status(400).json({
      error: error.message || 'Gagal memproses upload',
    });
  }
}
