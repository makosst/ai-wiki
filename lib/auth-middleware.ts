import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function validateApiKey(request: NextRequest): Promise<boolean> {
  const apiKey = request.headers.get('aiwiki_api_key');

  if (!apiKey) {
    return false;
  }

  // Validate API key against database
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, is_active, user_id')
    .eq('key', apiKey)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return false;
  }

  // Update last_used_at
  await supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id);

  return true;
}

export function createUnauthorizedResponse() {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      message: 'Invalid or missing API key. Please provide a valid API key in the AIWIKI_API_KEY header.'
    }),
    {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}
