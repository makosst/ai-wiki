'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseClient } from '@/lib/supabase-client';

type WorkflowListItem = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkflows();
  }, []);

  async function loadWorkflows() {
    try {
      setLoading(true);
      const { data: { user } } = await supabaseClient.auth.getUser();

      if (!user) {
        setError('Please log in to view workflows');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabaseClient
        .from('workflows')
        .select('id, name, description, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setWorkflows(data || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteWorkflow(id: string) {
    if (!confirm('Are you sure you want to delete this workflow?')) {
      return;
    }

    const { error: deleteError } = await supabaseClient
      .from('workflows')
      .delete()
      .eq('id', id);

    if (deleteError) {
      alert('Error deleting workflow: ' + deleteError.message);
    } else {
      loadWorkflows();
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto p-8">
        <div>Loading workflows...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-8">
        <div className="text-red-500">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">My Workflows</h1>
        <Link
          href="/workflows/new"
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Create New Workflow
        </Link>
      </div>

      {workflows.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No workflows yet. Create your first workflow!</p>
          <Link
            href="/workflows/new"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 inline-block"
          >
            Get Started
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              className="border rounded-lg p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h2 className="text-xl font-semibold mb-2">{workflow.name}</h2>
                  {workflow.description && (
                    <p className="text-gray-600 mb-3">{workflow.description}</p>
                  )}
                  <p className="text-sm text-gray-500">
                    Last updated: {new Date(workflow.updated_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/workflows/${workflow.id}`}
                    className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => deleteWorkflow(workflow.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
