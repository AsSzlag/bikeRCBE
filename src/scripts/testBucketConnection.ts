import { firebaseStorageService } from '../services/firebaseStorageService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testBucketConnection() {
  console.log('🧪 Testing Google Cloud Storage bucket connection...');
  console.log(`📦 Bucket: ${process.env.STORAGE_BUCKET_NAME || 'default'}`);
  
  try {
    // Test 1: Create a test file
    const testContent = Buffer.from('Hello from BikeRC Backend!', 'utf8');
    const testJobId = 'test-job-' + Date.now();
    const testFilename = 'test-connection.txt';
    
    console.log('📤 Uploading test file...');
    const uploadResult = await firebaseStorageService.uploadFile(
      testContent,
      testJobId,
      testFilename,
      'text/plain'
    );
    
    console.log('✅ Upload successful!');
    console.log('📄 File details:', {
      filename: uploadResult.filename,
      size: uploadResult.size,
      path: uploadResult.path,
      downloadUrl: uploadResult.downloadUrl.substring(0, 100) + '...'
    });
    
    // Test 2: List files for the test job
    console.log('📋 Listing files for test job...');
    const files = await firebaseStorageService.listJobFiles(testJobId);
    console.log(`✅ Found ${files.length} files:`, files.map(f => f.filename));
    
    // Test 3: Download the test file
    console.log('📥 Downloading test file...');
    const downloadedContent = await firebaseStorageService.downloadFile(testJobId, testFilename);
    console.log('✅ Download successful!');
    console.log('📄 Downloaded content:', downloadedContent.toString('utf8'));
    
    // Test 4: Clean up - delete the test file
    console.log('🗑️ Cleaning up test file...');
    const deleted = await firebaseStorageService.deleteFile(testJobId, testFilename);
    console.log(deleted ? '✅ Cleanup successful!' : '❌ Cleanup failed');
    
    console.log('\n🎉 All tests passed! Your bucket is properly configured.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('1. Check your .env file has the correct STORAGE_BUCKET_NAME');
    console.error('2. Verify your Firebase service account has Storage permissions');
    console.error('3. Ensure the bucket exists and is accessible');
    console.error('4. Check your Firebase project ID is correct');
  }
}

// Run the test
testBucketConnection().then(() => {
  console.log('\n✨ Test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Test crashed:', error);
  process.exit(1);
});
