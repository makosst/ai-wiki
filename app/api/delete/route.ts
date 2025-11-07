import { NextRequest, NextResponse } from 'next/server';
import { WikiService } from '@/lib/wiki-service';
import { validateApiKey, createUnauthorizedResponse } from '@/lib/auth-middleware';
import { z } from 'zod';

export async function DELETE(request: NextRequest) {
  // Validate API key
  const isValid = await validateApiKey(request);
  if (!isValid) {
    return createUnauthorizedResponse();
  }

  try {
    // Support both query params and JSON body
    let route: string | null = null;

    const { searchParams } = new URL(request.url);
    route = searchParams.get('route');

    // If not in query params, try to get from body
    if (!route) {
      try {
        const body = await request.json();
        route = body.route || null;
      } catch {
        // Body parsing failed, route remains null
      }
    }

    if (!route || typeof route !== 'string') {
      return NextResponse.json(
        {
          error: 'Invalid request',
          message: 'Parameter "route" is required and must be a string. Provide it as a query parameter (?route=...) or in the JSON body.',
        },
        { status: 400 }
      );
    }

    // Validate route with Zod
    try {
      const routeSchema = z.string().min(1);
      routeSchema.parse(route);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Route must be a non-empty string',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const result = await WikiService.delete(route);

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          route: result.route,
          deletedCount: result.deletedCount,
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
      const routesArraySchema = z.array(z.string().min(1));
      routesArraySchema.parse(routes);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            error: 'Validation error',
            message: 'Routes must be an array of non-empty strings',
            details: error.errors,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Process batch delete
    const results = await Promise.all(routes.map(route => WikiService.delete(route)));

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;
    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0);

    return NextResponse.json({
      success: failureCount === 0,
      summary: {
        total: results.length,
        successful: successCount,
        failed: failureCount,
        totalFilesDeleted: totalDeleted,
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
