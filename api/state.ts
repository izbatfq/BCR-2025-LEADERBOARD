import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  const state = (await kv.get('race_state')) || {};
  return new Response(JSON.stringify(state), {
    headers: { 'Content-Type': 'application/json' },
  });
}
