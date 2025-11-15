'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabaseClient } from '@/lib/supabase-client';
import { Button } from '@/components/retroui/Button';

export function AddToCursor() {
  const [apiKey, setApiKey] = useState<string | undefined>();

  useEffect(() => {
    const loadApiKey = async () => {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        const { data: apiKeys } = await supabaseClient
          .from('api_keys')
          .select('key')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1);

        if (apiKeys && apiKeys.length > 0) {
          setApiKey(apiKeys[0].key);
        }
      }
    };
    loadApiKey();
  }, []);

  // Generate Cursor install link with API key
  const getCursorInstallLink = () => {
    const config = {
        "type": "http",
        "url": "https://aiwiki.dev/api/mcp",
        "headers": {
          "AIWIKI_API_KEY": apiKey || "YOUR_API_KEY"
      }
    };

    const configBase64 = Buffer.from(JSON.stringify(config)).toString('base64');
    return `https://cursor.com/en-US/install-mcp?name=aiwiki&config=${configBase64}`;
  };

  return (
    <a href={getCursorInstallLink()} target="_blank" rel="noopener noreferrer">
      <Button variant="secondary" size="sm">
        <span className="flex items-center gap-2">
          Add to Cursor
          <Image src="/cursor2.png" alt="Cursor" width={16} height={16} className="inline-block" />
        </span>
      </Button>
    </a>
  );
}
