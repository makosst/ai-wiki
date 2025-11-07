import { WikiService } from '../lib/wiki-service';

async function verifyContribution() {
  try {
    console.log('Reading back contributed documentation...\n');

    const result = await WikiService.read('aiwiki/contributing/api-reference');

    if (result.success && result.content) {
      console.log('✅ Documentation found!');
      console.log(`Route: ${result.route}`);
      console.log(`File: ${result.fileName}`);
      console.log(`Content length: ${result.content.length} characters`);
      console.log('\nFirst 500 characters:');
      console.log('─'.repeat(80));
      console.log(result.content.substring(0, 500) + '...');
      console.log('─'.repeat(80));
    } else {
      console.error('❌ Documentation not found');
      console.error(result.message);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyContribution();
