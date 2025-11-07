import { WikiService } from '../lib/wiki-service';

async function verifyDomain() {
  try {
    const result = await WikiService.read('aiwiki/contributing/api-reference');

    if (result.success && result.content) {
      console.log('Base URL section:');
      console.log('─'.repeat(80));
      const baseUrlMatch = result.content.match(/## Base URL[\s\S]{0,300}/);
      if (baseUrlMatch) {
        console.log(baseUrlMatch[0]);
      }
      console.log('─'.repeat(80));

      // Check for domain occurrences
      const aiwikiDevCount = (result.content.match(/aiwiki\.dev/g) || []).length;
      console.log(`\n✅ Found ${aiwikiDevCount} references to aiwiki.dev`);

      // Verify no old domain references
      const oldDomainCount = (result.content.match(/your-domain\.com/g) || []).length;
      if (oldDomainCount > 0) {
        console.log(`⚠️  Still found ${oldDomainCount} references to your-domain.com`);
      } else {
        console.log('✅ No references to old placeholder domain found');
      }
    } else {
      console.error('Failed to read documentation');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyDomain();
