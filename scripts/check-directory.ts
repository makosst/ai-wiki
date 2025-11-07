import { WikiService } from '../lib/wiki-service';

async function checkDirectory() {
  try {
    console.log('Checking aiwiki/contributing directory...\n');

    const result = await WikiService.read('aiwiki/contributing');

    if (result.success && result.childRoutes) {
      console.log('✅ Directory found with child routes:');
      console.log(JSON.stringify(result.childRoutes, null, 2));
    } else {
      console.log('Result:', JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDirectory();
