import { WikiService } from '../lib/wiki-service';
import { readFileSync } from 'fs';
import { join } from 'path';

async function contributeApiDocs() {
  try {
    console.log('Reading API documentation...');
    const content = readFileSync(join(__dirname, '../temp-api-docs.md'), 'utf-8');

    console.log('Contributing to wiki...');
    const results = await WikiService.contribute([
      {
        fileName: 'api-reference.md',
        content: content,
        route: 'aiwiki/contributing/api-reference',
        contentType: 'text/markdown',
      },
    ]);

    console.log('\nResults:');
    console.log(JSON.stringify(results, null, 2));

    if (results[0]?.success) {
      console.log('\n✅ API documentation contributed successfully!');
      console.log(`Route: aiwiki/contributing/api-reference`);
      console.log(`File ID: ${results[0].fileId}`);
    } else {
      console.error('\n❌ Failed to contribute documentation');
      console.error(results[0]?.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

contributeApiDocs();
