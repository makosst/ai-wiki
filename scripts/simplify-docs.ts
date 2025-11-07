import { WikiService } from '../lib/wiki-service';

async function simplifyDocs() {
  try {
    console.log('Reading current API documentation...');

    const result = await WikiService.read('aiwiki/contributing/api-reference');

    if (!result.success || !result.content) {
      console.error('Failed to read documentation:', result.message);
      process.exit(1);
    }

    console.log('✅ Documentation read successfully');
    console.log('Removing non-API spec sections...');

    let content = result.content;

    // Remove "Last updated" footer
    content = content.replace(/---\s*\*Last updated:.*?\*\s*$/s, '');

    // Remove Support section
    content = content.replace(/## Support[\s\S]*?(?=##|$)/m, '');

    // Remove Storage Structure section
    content = content.replace(/### Storage Structure[\s\S]*?(?=###|##|$)/m, '');

    // Remove Data Schema section
    content = content.replace(/## Data Schema[\s\S]*?(?=##|$)/m, '');

    // Remove MCP endpoint section (keep other endpoints)
    content = content.replace(/### 4\. MCP \(Model Context Protocol\)[\s\S]*?(?=###|##|---)/m, '');

    // Remove Rate Limits section
    content = content.replace(/## Rate Limits[\s\S]*?(?=##|$)/m, '');

    // Clean up extra newlines and spacing
    content = content.replace(/\n{4,}/g, '\n\n\n');
    content = content.trim();

    console.log('Contributing simplified documentation...');

    const contributeResult = await WikiService.contribute([
      {
        fileName: 'api-reference.md',
        content: content,
        route: 'aiwiki/contributing/api-reference',
        contentType: 'text/markdown',
      },
    ]);

    console.log('\nResults:');
    console.log(JSON.stringify(contributeResult, null, 2));

    if (contributeResult[0]?.success) {
      console.log('\n✅ API documentation simplified successfully!');
      console.log(`Route: aiwiki/contributing/api-reference`);
      console.log(`Removed: Last updated, Support, Storage Structure, Data Schema, MCP, Rate Limits`);
      console.log(`New content length: ${content.length} characters`);
    } else {
      console.error('\n❌ Failed to update documentation');
      console.error(contributeResult[0]?.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

simplifyDocs();
