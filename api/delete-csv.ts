import { del, list } from '@vercel/blob';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method tidak diizinkan' });
  }

  try {
    const { kind } = req.query;

    if (!kind || typeof kind !== 'string') {
      return res.status(400).json({
        error: 'Parameter kind tidak ditemukan',
      });
    }

    const token = (process as any).env?.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      return res.status(500).json({
        error: 'BLOB_READ_WRITE_TOKEN belum dikonfigurasi',
      });
    }

    const { blobs } = await list({
      prefix: `${kind}-`,
      token,
    });

    await Promise.all(blobs.map((blob) => del(blob.url, {
      token,
    })));

    return res.status(200).json({ success: true });
  } catch (error: any) {
    console.error('Delete CSV error:', error);
    return res.status(500).json({
      error: error.message || 'Gagal menghapus CSV',
    });
  }
}

