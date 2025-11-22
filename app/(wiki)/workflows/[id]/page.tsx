'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabaseClient } from '@/lib/supabase-client';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import WorkflowNode from '@/components/workflow-node';

type Workflow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  workflow_data: {
    nodes: Node[];
    edges: Edge[];
    viewport?: { x: number; y: number; zoom: number };
  };
  created_at: string;
  updated_at: string;
};

export default function WorkflowEditorPage() {
  const params = useParams();
  const router = useRouter();
  const workflowId = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Define custom node types
  const nodeTypes = useMemo(() => ({ workflow: WorkflowNode }), []);

  useEffect(() => {
    if (workflowId && workflowId !== 'new') {
      loadWorkflow();
    } else {
      setLoading(false);
    }
  }, [workflowId]);

  async function loadWorkflow() {
    try {
      setLoading(true);
      const { data: { user } } = await supabaseClient.auth.getUser();

      if (!user) {
        alert('Please log in');
        router.push('/login');
        return;
      }

      const { data, error } = await supabaseClient
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        alert('Error loading workflow: ' + error.message);
        router.push('/workflows');
        return;
      }

      setWorkflow(data);
      setName(data.name);
      setDescription(data.description || '');

      // Ensure all nodes have the correct type
      const loadedNodes = (data.workflow_data.nodes || []).map((node: Node) => ({
        ...node,
        type: node.type === 'default' || !node.type ? 'workflow' : node.type,
      }));

      setNodes(loadedNodes);
      setEdges(data.workflow_data.edges || []);
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  async function saveWorkflow() {
    try {
      setSaving(true);
      const { data: { user } } = await supabaseClient.auth.getUser();

      if (!user) {
        alert('Please log in');
        return;
      }

      const workflowData = {
        nodes,
        edges,
      };

      if (workflowId === 'new') {
        // Create new workflow
        const { data, error } = await supabaseClient
          .from('workflows')
          .insert({
            user_id: user.id,
            name: name || 'Untitled Workflow',
            description: description || null,
            workflow_data: workflowData,
          })
          .select()
          .single();

        if (error) {
          alert('Error creating workflow: ' + error.message);
        } else {
          alert('Workflow created!');
          router.push(`/workflows/${data.id}`);
        }
      } else {
        // Update existing workflow
        const { error } = await supabaseClient
          .from('workflows')
          .update({
            name: name || 'Untitled Workflow',
            description: description || null,
            workflow_data: workflowData,
          })
          .eq('id', workflowId)
          .eq('user_id', user.id);

        if (error) {
          alert('Error saving workflow: ' + error.message);
        } else {
          alert('Workflow saved!');
          loadWorkflow();
        }
      }
    } catch (err) {
      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }

  function addNode() {
    // Calculate position based on existing nodes (left to right layout)
    const maxX = nodes.reduce((max, node) => Math.max(max, node.position.x), 0);
    const newNode: Node = {
      id: `node-${Date.now()}`,
      type: 'workflow',
      position: { x: maxX + 250, y: 100 },
      data: { label: 'New Step', description: '' },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
  }

  function updateNodeLabel(nodeId: string, label: string) {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, label } }
          : node
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, label } } : null
      );
    }
  }

  function updateNodeDescription(nodeId: string, description: string) {
    setNodes((nds) =>
      nds.map((node) =>
        node.id === nodeId
          ? { ...node, data: { ...node.data, description } }
          : node
      )
    );
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) =>
        prev ? { ...prev, data: { ...prev.data, description } } : null
      );
    }
  }

  function deleteNode(nodeId: string) {
    if (!confirm('Delete this step?')) return;

    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));

    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }

  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div>Loading workflow...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Top Bar */}
      <div className="border-b bg-white p-4 flex items-center justify-between">
        <div className="flex-1 flex gap-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Workflow name"
            className="px-3 py-2 border rounded flex-1 max-w-md"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="px-3 py-2 border rounded flex-1 max-w-md"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={addNode}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            Add Step
          </button>
          <button
            onClick={saveWorkflow}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => router.push('/workflows')}
            className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          >
            Back
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Left Sidebar */}
        <div className="w-80 border-r bg-gray-50 p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Step Editor</h2>

          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Step Name</label>
                <input
                  type="text"
                  value={String(selectedNode.data.label || '')}
                  onChange={(e) => updateNodeLabel(selectedNode.id, e.target.value)}
                  placeholder="Enter step name"
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <textarea
                  value={String(selectedNode.data.description || '')}
                  onChange={(e) => updateNodeDescription(selectedNode.id, e.target.value)}
                  placeholder="Describe what this step does..."
                  className="w-full px-3 py-2 border rounded h-32 resize-none"
                />
              </div>

              <div className="pt-4 border-t">
                <button
                  onClick={() => deleteNode(selectedNode.id)}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete Step
                </button>
              </div>

              <div className="text-xs text-gray-500">
                <p>Step ID: {selectedNode.id}</p>
                <p>Position: ({Math.round(selectedNode.position.x)}, {Math.round(selectedNode.position.y)})</p>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              <p>Click on a step to edit its properties.</p>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="font-medium text-blue-900 mb-2">Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Click &quot;Add Step&quot; to create a new node</li>
                  <li>Drag to connect steps</li>
                  <li>Click a step to edit its description</li>
                  <li>Steps flow from left to right</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* React Flow Canvas */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            fitView
            defaultEdgeOptions={{
              type: 'default',
              style: { stroke: '#000', strokeWidth: 2 },
            }}
          >
            <Controls />
            <MiniMap />
            <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
