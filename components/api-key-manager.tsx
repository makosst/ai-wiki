'use client';

import { useState, useEffect } from 'react';
import { supabaseClient } from '@/lib/supabase-client';
import type { User } from '@supabase/supabase-js';
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface ApiKey {
  id: string;
  key: string;
  name: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
}

const LOGIN_COOKIE_NAME = 'aiwiki_logged_in';

export function ApiKeyManager() {
  const [user, setUser] = useState<User | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showNewKey, setShowNewKey] = useState<string | null>(null);

  const syncLoginCookie = (signedIn: boolean) => {
    if (typeof document === 'undefined') return;
    const secureFlag = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
    const maxAge = signedIn ? 60 * 60 * 24 * 7 : 0; // one week
    document.cookie = `${LOGIN_COOKIE_NAME}=${signedIn ? '1' : ''}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secureFlag}`;
  };

  useEffect(() => {
    // Check if user is logged in and handle OAuth callback
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
      setIsLoading(false);
      syncLoginCookie(!!session?.user);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      syncLoginCookie(!!session?.user);

      // If sign in event, reload API keys
      if (event === 'SIGNED_IN' && session) {
        // Remove hash from URL
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
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
        redirectTo: `${window.location.origin}/preview/api-keys`,
      },
    });
  };

  const handleSignOut = async () => {
    await supabaseClient.auth.signOut();
    syncLoginCookie(false);
    setApiKeys([]);
  };

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      alert('Please provide a name for the API key');
      return;
    }

    // Generate a secure random API key with aiwiki_ prefix
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
      alert(`Error creating API key: ${error.message}`);
      return;
    }

    setShowNewKey(key);
    setNewKeyName('');
    loadApiKeys();
  };

  const revokeApiKey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) {
      return;
    }

    const { error } = await supabaseClient
      .from('api_keys')
      .delete()
      .eq('id', id);

    if (error) {
      alert(`Error revoking API key: ${error.message}`);
      return;
    }

    loadApiKeys();
  };

  if (isLoading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'monospace' }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className={cn("flex flex-col gap-6 w-full max-w-md")}>
          <Card>
            <CardHeader>
              <CardTitle>API Key Management</CardTitle>
              <CardDescription>
                Sign in to generate and manage API keys for accessing the MCP endpoint
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); handleSignIn(); }}>
                <FieldGroup>
                  <Field>
                    <Button
                      variant="outline"
                      type="submit"
                      className="w-full"
                    >
                      Login with Google
                    </Button>
                  </Field>
                </FieldGroup>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">API Key Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Signed in as {user.email}</p>
        </div>
        <Button
          onClick={handleSignOut}
          variant="destructive"
        >
          Sign Out
        </Button>
      </div>

      {showNewKey && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-900">New API Key Created!</CardTitle>
            <CardDescription className="text-green-700">
              Save this key securely. You won&apos;t be able to see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <code className="block p-3 bg-white border border-gray-300 rounded text-xs break-all font-mono mb-3">
              {showNewKey}
            </code>
            <div className="flex gap-2">
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(showNewKey);
                  alert('API key copied to clipboard!');
                }}
                variant="default"
              >
                Copy to Clipboard
              </Button>
              <Button
                onClick={() => setShowNewKey(null)}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Generate New API Key</CardTitle>
          <CardDescription>
            Create a new API key to authenticate requests to the MCP endpoint
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => { e.preventDefault(); generateApiKey(); }}>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="keyName">API Key Name</FieldLabel>
                <Input
                  id="keyName"
                  type="text"
                  placeholder="e.g., 'Production Server'"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  required
                />
                <FieldDescription>
                  Give your API key a descriptive name to help you remember what it&apos;s used for
                </FieldDescription>
              </Field>
              <Field>
                <Button type="submit" className="w-full">
                  Generate Key
                </Button>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys ({apiKeys.length})</CardTitle>
          <CardDescription>
            Manage your existing API keys
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No API keys yet. Generate one above.
            </p>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((apiKey) => (
                <div
                  key={apiKey.id}
                  className="p-4 border rounded-lg bg-background"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold mb-1">
                        {apiKey.name}
                      </div>
                      <code className="text-xs text-muted-foreground block mb-2 truncate">
                        {apiKey.key.substring(0, 20)}...{apiKey.key.substring(apiKey.key.length - 10)}
                      </code>
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(apiKey.created_at).toLocaleString()}
                        {apiKey.last_used_at && (
                          <> | Last used: {new Date(apiKey.last_used_at).toLocaleString()}</>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        onClick={() => revokeApiKey(apiKey.id)}
                        variant="destructive"
                        size="sm"
                      >
                        Revoke
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-blue-900">Using Your API Key</CardTitle>
          <CardDescription className="text-blue-700">
            Include your API key in requests to the MCP endpoint using the AIWIKI_API_KEY header
          </CardDescription>
        </CardHeader>
        <CardContent>
          <code className="block p-3 bg-white border border-gray-300 rounded text-xs font-mono">
            AIWIKI_API_KEY: aiwiki_your_api_key_here
          </code>
          <p className="text-xs text-blue-700 mt-3">
            Example: <code className="bg-white px-1 py-0.5 rounded">AIWIKI_API_KEY: aiwiki_a1b2c3d4...</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
