import { list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  try {
    const token = (process as any).env?.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'BLOB_READ_WRITE_TOKEN belum dikonfigurasi',
      });
    }

    const { blobs } = await list({
      token,
    });

    const csvKinds = ['master', 'start', 'finish', 'checkpoint'];
    const meta: Array<{ key: string; filename: string; updatedAt: number; rows: number }> = [];

    for (const kind of csvKinds) {
      const kindBlobs = blobs
        .filter((b) => b.pathname.startsWith(`${kind}-`))
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      if (kindBlobs.length > 0) {
        const latest = kindBlobs[0];
        // Try to extract row count from filename or fetch and count
        const response = await fetch(latest.url);
        const text = await response.text();
        const rows = text.split('\n').filter((line) => line.trim().length > 0).length - 1; // minus header

        meta.push({
          key: kind,
          filename: latest.pathname.replace(`${kind}-`, '').replace(/^\d+-/, ''),
          updatedAt: new Date(latest.uploadedAt).getTime(),
          rows: Math.max(0, rows),
        });
      }
    }

    return res.status(200).json(meta);
  } catch (error: any) {
    console.error('List CSV error:', error);
    return res.status(500).json({
      error: error.message || 'Gagal mengambil daftar CSV',
    });
  }
}

