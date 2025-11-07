import { WikiService } from '../lib/wiki-service';

async function updateDomain() {
  try {
    console.log('Reading current API documentation...');

    const result = await WikiService.read('aiwiki/contributing/api-reference');

    if (!result.success || !result.content) {
      console.error('Failed to read documentation:', result.message);
      process.exit(1);
    }

    console.log('✅ Documentation read successfully');
    console.log('Updating domain to aiwiki.dev...');

    // Replace domain references
    const updatedContent = result.content
      .replace(/https:\/\/your-domain\.com/g, 'https://aiwiki.dev')
      .replace(/http:\/\/localhost:3000/g, 'http://localhost:3000 or https://aiwiki.dev');

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
      console.log(`Domain updated to: aiwiki.dev`);
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

updateDomain();
