'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { supabaseClient } from '@/lib/supabase-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/retroui/Card';
import { Button } from '@/components/retroui/Button';
import { Input } from '@/components/retroui/Input';
import { Label } from '@/components/retroui/Label';
import { CopyButton } from '@/components/copy-button';

interface AddToClaudeCodeProps {
  apiKey?: string;
}

export function AddToClaudeCode({ apiKey: serverApiKey }: AddToClaudeCodeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [apiKey, setApiKey] = useState<string | undefined>(serverApiKey);

  useEffect(() => {
    // Fetch API key from client side if not provided from server
    if (!apiKey) {
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
    }
  }, [apiKey]);

  const command = apiKey
    ? `claude mcp add --transport http aiwiki https://aiwiki.dev/api/mcp --header "AIWIKI_API_KEY: ${apiKey}"`
    : 'claude mcp add --transport http aiwiki https://aiwiki.dev/api/mcp --header "AIWIKI_API_KEY: YOUR_API_KEY"';

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setIsOpen(true)}>
        <span className="flex items-center gap-2">
          Add to Claude Code
          <Image src="/claude1.png" alt="Claude" width={16} height={16} className="inline-block" />
        </span>
      </Button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-w-2xl w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle>Add AI Wiki to Claude Code</CardTitle>
                    <CardDescription className="mt-2">
                      Copy and run this command in your terminal to add AI Wiki as an MCP server
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsOpen(false)}
                    className="ml-4"
                  >
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!apiKey && (
                    <div className="p-3 border-2 border-yellow-500 bg-yellow-50 rounded" style={{ boxShadow: "2px 2px 0px 0px rgba(0, 0, 0, 1)" }}>
                      <p className="text-sm text-yellow-800">
                        ⚠️ You need an API key to use this MCP server. Please{' '}
                        <a href="/api-keys" className="underline font-semibold hover:text-yellow-900">
                          generate one here
                        </a>
                        .
                      </p>
                    </div>
                  )}

                  <div className="grid w-full items-center gap-1.5">
                    <Label htmlFor="claude-command">Command</Label>
                    <div className="flex items-stretch gap-2">
                      <Input
                        id="claude-command"
                        value={command}
                        readOnly
                        className="flex-1 font-mono text-sm"
                      />
                      <div className="flex items-center">
                        <CopyButton text={command} size="md" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="font-semibold">What this does:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Adds AI Wiki as an MCP server to Claude Code</li>
                      <li>Enables you to search and read AI Wiki content directly from Claude</li>
                      <li>Uses your API key for authenticated access</li>
                    </ul>
                  </div>

                  <div className="space-y-2 text-sm text-gray-700">
                    <p className="font-semibold">Next steps:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Copy the command above</li>
                      <li>Open your terminal</li>
                      <li>Paste and run the command</li>
                      <li>Restart Claude Code to activate the MCP server</li>
                    </ol>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
