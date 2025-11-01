import { z } from 'zod';
import { createMcpHandler } from 'mcp-handler';

const handler = createMcpHandler(
  (server) => {
    server.tool(
      'read',
      'Read content from the AI wiki',
      { topic: z.string().describe('The topic to read about') },
      async ({ topic }) => {
        // TODO: Implement actual read logic
        return {
          content: [
            {
              type: 'text',
              text: `Reading content about "${topic}" from the AI wiki...`,
            },
          ],
        };
      },
    );

    server.tool(
      'contribute',
      'Contribute new content to the AI wiki',
      {
        topic: z.string().describe('The topic to contribute to'),
        content: z.string().describe('The content to contribute'),
      },
      async ({ topic, content }) => {
        // TODO: Implement actual contribute logic
        return {
          content: [
            {
              type: 'text',
              text: `Contribution received for topic "${topic}". Content preview: ${content.substring(0, 50)}...`,
            },
          ],
        };
      },
    );
  },
  {},
  { basePath: '/api' },
);

export { handler as GET, handler as POST, handler as DELETE };
