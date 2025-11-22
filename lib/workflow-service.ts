import { supabase } from '@/lib/supabase';
import { z } from 'zod';

// ReactFlow types - using the standard ReactFlowJsonObject structure
export const workflowDataSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
});

export const createWorkflowSchema = z.object({
  name: z.string().min(1).describe('Name of the workflow'),
  description: z.string().optional().describe('Optional description of the workflow'),
  workflow_data: workflowDataSchema.describe('ReactFlow graph data (nodes, edges, viewport)'),
});

export const updateWorkflowSchema = z.object({
  id: z.string().uuid().describe('Workflow ID to update'),
  name: z.string().min(1).optional().describe('New name for the workflow'),
  description: z.string().optional().describe('New description for the workflow'),
  workflow_data: workflowDataSchema.optional().describe('Updated ReactFlow graph data'),
});

export const workflowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  workflow_data: workflowDataSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const workflowListItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

// Inferred types
export type WorkflowData = z.infer<typeof workflowDataSchema>;
export type CreateWorkflow = z.infer<typeof createWorkflowSchema>;
export type UpdateWorkflow = z.infer<typeof updateWorkflowSchema>;
export type Workflow = z.infer<typeof workflowSchema>;
export type WorkflowListItem = z.infer<typeof workflowListItemSchema>;

export class WorkflowService {
  /**
   * List all workflows for a user
   */
  static async list(userId: string): Promise<{ success: boolean; workflows?: WorkflowListItem[]; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('id, name, description, created_at, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, workflows: data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get a specific workflow by ID
   */
  static async get(workflowId: string, userId: string): Promise<{ success: boolean; workflow?: Workflow; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflowId)
        .eq('user_id', userId)
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Workflow not found' };
      }

      return { success: true, workflow: data as Workflow };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a new workflow
   */
  static async create(userId: string, workflow: CreateWorkflow): Promise<{ success: boolean; workflow?: Workflow; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('workflows')
        .insert({
          user_id: userId,
          name: workflow.name,
          description: workflow.description || null,
          workflow_data: workflow.workflow_data,
        })
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, workflow: data as Workflow };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Update an existing workflow
   */
  static async update(userId: string, update: UpdateWorkflow): Promise<{ success: boolean; workflow?: Workflow; error?: string }> {
    try {
      const updateData: Record<string, any> = {};

      if (update.name !== undefined) updateData.name = update.name;
      if (update.description !== undefined) updateData.description = update.description;
      if (update.workflow_data !== undefined) updateData.workflow_data = update.workflow_data;

      const { data, error } = await supabase
        .from('workflows')
        .update(updateData)
        .eq('id', update.id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      if (!data) {
        return { success: false, error: 'Workflow not found or you do not have permission to update it' };
      }

      return { success: true, workflow: data as Workflow };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Delete a workflow
   */
  static async delete(workflowId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('workflows')
        .delete()
        .eq('id', workflowId)
        .eq('user_id', userId);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
