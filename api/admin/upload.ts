import { put } from '@vercel/blob';
import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const auth = req.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${process.env.ADMIN_USER}:${process.env.ADMIN_PASS}`);
  if (auth !== expected) return new Response('Unauthorized', { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file');
  const type = formData.get('type'); // master | finish | checkpoint

  const blob = await put(`race/${type}.csv`, file, { access: 'public' });
  const state = (await kv.get('race_state')) || {};
  state[type] = blob.url;
  state.updatedAt = new Date().toISOString();
  await kv.set('race_state', state);

  return new Response(JSON.stringify({ success: true, url: blob.url }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
