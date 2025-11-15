import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const singleContributionSchema = z.object({
  fileName: z.string().describe('The name of the file (e.g., "shadcn-guide.md")'),
  content: z.string().describe('The file content as a string'),
  route: z.string().describe('The route path for this content (e.g., "shadcn/installation")'),
  contentType: z
    .string()
    .optional()
    .describe('MIME type of the file (e.g., "text/markdown"). Defaults to "text/plain"'),
});

const payloadSchema = z.union([
  singleContributionSchema,
  z
    .array(singleContributionSchema)
    .min(1)
    .describe('List of contributions to upload and map in a single call.'),
  z.object({
    contributions: z
      .array(singleContributionSchema)
      .min(1)
      .describe('List of contributions to upload and map in a single call.'),
  }),
]);

type Contribution = z.infer<typeof singleContributionSchema>;

type ContributionResult = {
  success: boolean;
  route: string;
  fileId?: string;
  fileName?: string;
  message: string;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  const parsed = payloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Invalid payload.',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  let contributions: Contribution[];

  if (Array.isArray(parsed.data)) {
    contributions = parsed.data;
  } else if ('contributions' in parsed.data) {
    contributions = parsed.data.contributions;
  } else {
    contributions = [parsed.data];
  }

  const results: ContributionResult[] = [];

  for (const contribution of contributions) {
    const { fileName, content, route, contentType = 'text/plain' } = contribution;

    try {
      const fileId = crypto.randomUUID();
      const filePath = `${fileId}/${fileName}`;

      // Upload the file content to Supabase storage
      const { error: uploadError } = await supabase.storage
        .from('ai-wiki-storage')
        .upload(filePath, content, {
          contentType,
          upsert: false,
        });

      if (uploadError) {
        results.push({
          success: false,
          route,
          fileName,
          message: `Upload failed for route "${route}": ${uploadError.message}`,
        });
        continue;
      }

      // Map the uploaded file to the provided route
      const { error: insertError } = await supabase
        .from('wiki_files_index')
        .upsert(
          {
            route,
            file_id: fileId,
            file_name: fileName,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'route',
          },
        );

      if (insertError) {
        results.push({
          success: false,
          route,
          fileName,
          message: `Index update failed for route "${route}": ${insertError.message}`,
        });
        continue;
      }

      results.push({
        success: true,
        route,
        fileId,
        fileName,
        message: `Route "${route}" mapped to file ID ${fileId}`,
      });
    } catch (error) {
      results.push({
        success: false,
        route,
        fileName,
        message: `Unexpected error for route "${route}": ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }

  const successCount = results.filter((result) => result.success).length;
  const failureCount = results.length - successCount;

  return NextResponse.json(
    {
      processed: results.length,
      successCount,
      failureCount,
      results,
    },
    {
      status: failureCount === results.length && results.length > 0 ? 500 : 200,
    },
  );
}
