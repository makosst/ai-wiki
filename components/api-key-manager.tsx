'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import type { User } from '@supabase/supabase-js';
import ReactMarkdown from 'react-markdown';

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
    const content = `
${createAsciiHeader('🔑 API KEY MANAGEMENT')}

Loading...
`;
    return (
      <div className="preview-container">
        <div className="preview-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    );
  }

  if (!user) {
    const content = `
[← Back to Wiki](/)

${createAsciiHeader('🔑 API KEY MANAGEMENT')}

Sign in with Google to manage your API keys.

\`\`\`
${createAsciiBox(['Click the button below to sign in with your Google account'])}
\`\`\`
`;

    return (
      <div className="preview-container">
        <div className="preview-content">
          <ReactMarkdown>{content}</ReactMarkdown>
          <button
            onClick={handleSignIn}
            style={{
              fontFamily: 'monospace',
              padding: '10px 20px',
              marginTop: '20px',
              cursor: 'pointer',
              backgroundColor: '#333',
              color: '#fff',
              border: '2px solid #666',
              borderRadius: '4px',
            }}
          >
            🔐 Sign In with Google
          </button>
        </div>
      </div>
    );
  }

  const content = `
[← Back to Wiki](/)

${createAsciiHeader('🔑 API KEY MANAGEMENT')}

## Your API Keys (${apiKeys.length})

${statusMessage ? `\n**${statusMessage}**\n` : ''}

${showNewKey ? `
---

## ✨ New API Key Created!

**⚠️  IMPORTANT:** Save this key now. You won't be able to see it again.

\`\`\`
${showNewKey}
\`\`\`

` : ''}
`;

  return (
    <div className="preview-container">
      <div className="preview-content">
        <ReactMarkdown>{content}</ReactMarkdown>

        {showNewKey && (
          <div style={{ marginTop: '10px', marginBottom: '20px' }}>
            <button
              onClick={() => {
                navigator.clipboard.writeText(showNewKey);
                setStatusMessage('✅ API key copied to clipboard!');
              }}
              style={{
                fontFamily: 'monospace',
                padding: '8px 16px',
                marginRight: '10px',
                cursor: 'pointer',
                backgroundColor: '#2d5',
                color: '#fff',
                border: '2px solid #1a3',
                borderRadius: '4px',
              }}
            >
              📋 Copy Key
            </button>
            <button
              onClick={() => setShowNewKey(null)}
              style={{
                fontFamily: 'monospace',
                padding: '8px 16px',
                cursor: 'pointer',
                backgroundColor: '#666',
                color: '#fff',
                border: '2px solid #888',
                borderRadius: '4px',
              }}
            >
              ✖ Close
            </button>
          </div>
        )}

        {apiKeys.length > 0 && (
          <div style={{ marginTop: '20px', marginBottom: '30px' }}>
            {apiKeys.map((key) => {
              const masked = `${key.key.substring(0, 15)}...${key.key.substring(key.key.length - 8)}`;
              const created = new Date(key.created_at).toLocaleDateString();
              return (
                <div
                  key={key.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '10px',
                    fontFamily: 'monospace',
                    padding: '10px',
                    border: '1px solid #444',
                    borderRadius: '4px'
                  }}
                >
                  <div>
                    <strong>{key.name}</strong> | {masked} | Created: {created}
                  </div>
                  <button
                    onClick={() => revokeApiKey(key.id, key.name)}
                    style={{
                      fontFamily: 'monospace',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      backgroundColor: '#d33',
                      color: '#fff',
                      border: '2px solid #a11',
                      borderRadius: '4px',
                      marginLeft: '10px',
                      flexShrink: 0
                    }}
                  >
                    🗑️ Revoke
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {!showNewKey && (
          <form onSubmit={generateApiKey} style={{ marginTop: '20px', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="e.g., 'Production Server'"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              required
              style={{
                fontFamily: 'monospace',
                padding: '10px',
                width: '300px',
                marginRight: '10px',
                border: '2px solid #666',
                borderRadius: '4px'
              }}
            />
            <button
              type="submit"
              style={{
                fontFamily: 'monospace',
                padding: '10px 20px',
                cursor: 'pointer',
                backgroundColor: '#37d',
                color: '#fff',
                border: '2px solid #25b',
                borderRadius: '4px',
              }}
            >
              ➕ Create API Key
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
