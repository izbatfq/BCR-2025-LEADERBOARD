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

    const latestBlob = blobs
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())[0];

    if (!latestBlob) {
      return res.status(404).json({ error: 'CSV tidak ditemukan' });
    }

    const response = await fetch(latestBlob.url);
    const text = await response.text();

    return res.status(200).json({
      text,
      filename: latestBlob.pathname,
      updatedAt: new Date(latestBlob.uploadedAt).getTime(),
    });
  } catch (error: any) {
    console.error('Get CSV error:', error);
    return res.status(500).json({
      error: error.message || 'Gagal mengambil CSV',
    });
  }
}

