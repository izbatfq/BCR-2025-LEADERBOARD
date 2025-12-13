import { kv } from '@vercel/kv';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const auth = req.headers.get('authorization');
  const expected = 'Basic ' + btoa(`${process.env.ADMIN_USER}:${process.env.ADMIN_PASS}`);
  if (auth !== expected) return new Response('Unauthorized', { status: 401 });

  const body = await req.json();
  const state = (await kv.get('race_state')) || {};
  Object.assign(state, body);
  state.updatedAt = new Date().toISOString();
  await kv.set('race_state', state);

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
