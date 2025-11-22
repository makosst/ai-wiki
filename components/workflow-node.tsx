import { Handle, Position, type NodeProps } from '@xyflow/react';

export default function WorkflowNode({ data, selected }: NodeProps) {
  const label = (data as any)?.label || 'Untitled Step';
  const description = (data as any)?.description;

  // Truncate description to 120 characters
  const truncatedDescription = description
    ? description.length > 120
      ? description.substring(0, 120) + '...'
      : description
    : '';

  return (
    <div
      className={`px-4 py-3 shadow-md rounded-lg border-2 bg-white min-w-[180px] max-w-[280px] ${
        selected ? 'border-blue-500' : 'border-gray-300'
      }`}
    >
      {/* Left handle (input) */}
      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 !bg-gray-400"
      />

      {/* Node content */}
      <div className="text-sm font-medium text-gray-900 break-words">
        {label}
      </div>
      {truncatedDescription && (
        <div className="text-xs text-gray-500 mt-2 leading-relaxed break-words">
          {truncatedDescription}
        </div>
      )}

      {/* Right handle (output) */}
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 !bg-blue-500"
      />
    </div>
  );
}
