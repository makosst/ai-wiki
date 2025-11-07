import { WikiService } from '../lib/wiki-service';

async function updateBaseUrl() {
  try {
    console.log('Reading current API documentation...');

    const result = await WikiService.read('aiwiki/contributing/api-reference');

    if (!result.success || !result.content) {
      console.error('Failed to read documentation:', result.message);
      process.exit(1);
    }

    console.log('✅ Documentation read successfully');
    console.log('Updating Base URL section...');

    // Update the Base URL section to only show production
    let updatedContent = result.content.replace(
      /## Base URL\s+```\s+http:\/\/localhost:3000 or https:\/\/aiwiki\.dev\/api\s+# Development\s+https:\/\/aiwiki\.dev\/api\s+# Production\s+```/,
      `## Base URL

\`\`\`
https://aiwiki.dev/api
\`\`\``
    );

    // Also update any curl examples that reference localhost to only show aiwiki.dev
    updatedContent = updatedContent.replace(
      /http:\/\/localhost:3000 or https:\/\/aiwiki\.dev/g,
      'https://aiwiki.dev'
    );

    console.log('Contributing updated documentation...');

    const contributeResult = await WikiService.contribute([
      {
        fileName: 'api-reference.md',
        content: updatedContent,
        route: 'aiwiki/contributing/api-reference',
        contentType: 'text/markdown',
      },
    ]);

    console.log('\nResults:');
    console.log(JSON.stringify(contributeResult, null, 2));

    if (contributeResult[0]?.success) {
      console.log('\n✅ API documentation updated successfully!');
      console.log(`Route: aiwiki/contributing/api-reference`);
      console.log(`Base URL now shows only production: https://aiwiki.dev/api`);
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

updateBaseUrl();
