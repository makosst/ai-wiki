import { NextRequest, NextResponse } from 'next/server';
import { WikiService, contributionSchema, type Contribution } from '@/lib/wiki-service';
import { validateApiKey, createUnauthorizedResponse } from '@/lib/auth-middleware';
import { z } from 'zod';

export async function POST(request: NextRequest) {
  // Validate API key
  const isValid = await validateApiKey(request);
  if (!isValid) {
    return createUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Support both single contribution and batch contributions
    let contributions: Contribution[];

    if (Array.isArray(body)) {
      contributions = body;
    } else if (body.contributions && Array.isArray(body.contributions)) {
      contributions = body.contributions;
    } else if (body.fileName && body.content && body.route) {
      contributions = [body];
    } else {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Request must contain either a single contribution object, an array of contributions, or a "contributions" array field.',
        },
        { status: 400 }
      );
    }

    // Validate contributions with Zod
    try {
      const contributionsArraySchema = z.array(contributionSchema);
      contributionsArraySchema.parse(contributions);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Invalid contribution data',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Process contributions
    const results = await WikiService.contribute(contributions);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      success: failureCount === 0,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
      },
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
