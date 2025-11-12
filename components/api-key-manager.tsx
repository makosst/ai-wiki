'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import type { User } from '@supabase/supabase-js';
import { Button } from '@/components/retroui/Button';
import { Input } from '@/components/retroui/Input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/retroui/Card';
import { Text } from '@/components/retroui/Text';
import Link from 'next/link';

interface ApiKey {
  id: string;
  key: string;
  name: string;
  created_at: string;
}

const LOGIN_COOKIE_NAME = 'aiwiki_logged_in';

function createAsciiHeader(title: string): string {
  const width = Math.max(title.length + 4, 60);
  const topBorder = '┌' + '─'.repeat(width - 2) + '┐';
  const bottomBorder = '└' + '─'.repeat(width - 2) + '┘';
  const padding = Math.max(0, width - 4 - title.length);
  const titleLine = '│ ' + title + ' '.repeat(padding) + ' │';

  return [topBorder, titleLine, bottomBorder].join('\n');
}

function createAsciiBox(lines: string[], width: number = 80): string {
  const topBorder = '╔' + '═'.repeat(width - 2) + '╗';
  const bottomBorder = '╚' + '═'.repeat(width - 2) + '╝';

  const paddedLines = lines.map(line => {
    const padding = Math.max(0, width - 4 - line.length);
    return '║ ' + line + ' '.repeat(padding) + ' ║';
  });

  return [topBorder, ...paddedLines, bottomBorder].join('\n');
}

export function ApiKeyManager() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');

  const syncLoginCookie = (signedIn: boolean) => {
    if (typeof document === 'undefined') return;
    const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    const maxAge = signedIn ? 60 * 60 * 24 * 7 : 0;
    document.cookie = `${LOGIN_COOKIE_NAME}=${signedIn ? '1' : ''}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`;
  };

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      syncLoginCookie(!!session?.user);
      setIsLoading(false);

      if (event === 'SIGNED_IN' && session) {
        // Clear the hash from URL after successful sign in
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        // Reload API keys
        loadApiKeys();
      }
    });

    // Then get the current session (this will also process OAuth callback hash if present)
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setIsLoading(false);
      syncLoginCookie(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      loadApiKeys();
    }
  }, [user]);

  const loadApiKeys = async () => {
    const { data, error } = await supabaseClient
      .from('api_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setApiKeys(data);
    }
  };

  const handleSignIn = async () => {
    await supabaseClient.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/api-keys`,
      },
    });
  };

  const generateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newKeyName.trim()) {
      setStatusMessage('⚠️  Please provide a name for the API key');
      return;
    }

    const key = `aiwiki_${Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}`;

    const { data, error } = await supabaseClient
      .from('api_keys')
      .insert({
        key,
        name: newKeyName,
        user_id: user?.id,
      })
      .select()
      .single();

    if (error) {
      setStatusMessage(`❌ Error: ${error.message}`);
      return;
    }

    setShowNewKey(key);
    setNewKeyName('');
    setStatusMessage('');
    loadApiKeys();
  };

  const revokeApiKey = async (id: string, name: string) => {
    if (!confirm(`Revoke API key "${name}"? This cannot be undone.`)) {
      return;
    }

    const { error } = await supabaseClient
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) {
      setStatusMessage(`❌ Error: ${error.message}`);
      return;
    }

    setStatusMessage(`✅ API key "${name}" revoked`);
    loadApiKeys();
  };

  if (isLoading) {
    return (
      <div className="preview-container">
        <div className="preview-content">
          <div className="mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">← Back to Wiki</Button>
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>🔑 API Key Management</CardTitle>
              <CardDescription>Loading...</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="preview-container">
        <div className="preview-content">
          <div className="mb-4">
            <Link href="/">
              <Button variant="outline" size="sm">← Back to Wiki</Button>
            </Link>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>🔑 API Key Management</CardTitle>
              <CardDescription>Sign in with Google to manage your API keys.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleSignIn}
                variant="secondary"
                size="lg"
              >
                🔐 Sign In with Google
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="preview-container">
      <div className="preview-content">
        <div className="mb-4">
          <Link href="/">
            <Button variant="outline" size="sm">← Back to Wiki</Button>
          </Link>
        </div>

        <Card className="mb-4">
          <CardHeader>
            <CardTitle>🔑 API Key Management</CardTitle>
            <CardDescription>Your API Keys ({apiKeys.length})</CardDescription>
          </CardHeader>
        </Card>

        {statusMessage && (
          <Card className="mb-4">
            <CardContent className="pt-4">
              <Text>{statusMessage}</Text>
            </CardContent>
          </Card>
        )}

        {showNewKey && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>✨ New API Key Created!</CardTitle>
              <CardDescription>⚠️ IMPORTANT: Save this key now. You won't be able to see it again.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-3 bg-muted rounded border-2 border-black font-mono text-sm break-all">
                {showNewKey}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    navigator.clipboard.writeText(showNewKey);
                    setStatusMessage('✅ API key copied to clipboard!');
                  }}
                  variant="secondary"
                  size="md"
                >
                  📋 Copy Key
                </Button>
                <Button
                  onClick={() => setShowNewKey(null)}
                  variant="secondary"
                  size="md"
                >
                  ✖ Close
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {apiKeys.length > 0 && (
          <Card className="mb-4">
            <CardHeader>
              <CardTitle>Your API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {apiKeys.map((key) => {
                  const masked = `${key.key.substring(0, 15)}...${key.key.substring(key.key.length - 8)}`;
                  const created = new Date(key.created_at).toLocaleDateString();
                  return (
                    <div
                      key={key.id}
                      className="flex justify-between items-center p-3 border-2 border-black rounded"
                    >
                      <div className="font-mono text-sm">
                        <strong>{key.name}</strong> | {masked} | Created: {created}
                      </div>
                      <Button
                        onClick={() => revokeApiKey(key.id, key.name)}
                        variant="secondary"
                        size="sm"
                        className="ml-2 flex-shrink-0"
                      >
                        🗑️
                      </Button>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {!showNewKey && (
          <Card>
            <CardHeader>
              <CardTitle>Create New API Key</CardTitle>
              <CardDescription>Enter a name for your new API key</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={generateApiKey} className="space-y-4">
                <Input
                  type="text"
                  placeholder="e.g., 'Production Server'"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                  className="w-full max-w-md"
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                >
                  ➕ Create API Key
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
