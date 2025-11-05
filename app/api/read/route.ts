import { NextRequest, NextResponse } from 'next/server';
import { WikiService } from '@/lib/wiki-service';
import { validateApiKey, createUnauthorizedResponse } from '@/lib/auth-middleware';
import { z } from 'zod';

export async function GET(request: NextRequest) {
  // Validate API key
  const isValid = await validateApiKey(request);
  if (!isValid) {
    return createUnauthorizedResponse();
  }

  try {
    const { searchParams } = new URL(request.url);
    const route = searchParams.get('route');

    if (!route || typeof route !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Query parameter "route" is required and must be a string.',
        },
        { status: 400 }
      );
    }

    const result = await WikiService.read(route);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          route: result.route,
          message: result.message,
        },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
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

export async function POST(request: NextRequest) {
  // Validate API key
  const isValid = await validateApiKey(request);
  if (!isValid) {
    return createUnauthorizedResponse();
  }

  try {
    const body = await request.json();

    // Support both single route and batch routes
    let routes: string[];

    if (Array.isArray(body)) {
      routes = body;
    } else if (body.routes && Array.isArray(body.routes)) {
      routes = body.routes;
    } else if (typeof body.route === 'string') {
      routes = [body.route];
    } else {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Request must contain either a "route" string, an array of routes, or a "routes" array field.',
        },
        { status: 400 }
      );
    }

    // Validate routes with Zod
    try {
      const routesArraySchema = z.array(z.string());
      routesArraySchema.parse(routes);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Routes must be an array of strings',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Process batch read
    const results = await WikiService.batchRead(routes);

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
