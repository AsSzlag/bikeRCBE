import { firebaseStorageService } from '../services/firebaseStorageService.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Test script for Firebase Storage functionality
 */
async function testFirebaseStorage() {
  const testJobId = 'test-job-123';
  const testFilename = 'test-file.txt';
  const testContent = 'Hello, Firebase Storage! This is a test file.';
  
  console.log('🧪 Testing Firebase Storage functionality...');
  
  try {
    // Test 1: Upload a file
    console.log('\n1️⃣ Testing file upload...');
    const uploadResult = await firebaseStorageService.uploadFile(
      Buffer.from(testContent, 'utf8'),
      testJobId,
      testFilename,
      'text/plain'
    );
    
    console.log('✅ File uploaded successfully!');
    console.log(`   📁 Filename: ${uploadResult.filename}`);
    console.log(`   📏 Size: ${uploadResult.size} bytes`);
    console.log(`   🔗 Download URL: ${uploadResult.downloadUrl}`);
    console.log(`   📍 Path: ${uploadResult.path}`);
    
    // Test 2: List files for the job
    console.log('\n2️⃣ Testing file listing...');
    const files = await firebaseStorageService.listJobFiles(testJobId);
    console.log(`✅ Found ${files.length} files for job ${testJobId}`);
    
    for (const file of files) {
      console.log(`   📄 ${file.filename} (${file.size} bytes)`);
    }
    
    // Test 3: Download the file
    console.log('\n3️⃣ Testing file download...');
    const downloadedBuffer = await firebaseStorageService.downloadFile(testJobId, testFilename);
    const downloadedContent = downloadedBuffer.toString('utf8');
    
    console.log('✅ File downloaded successfully!');
    console.log(`   📏 Downloaded size: ${downloadedBuffer.length} bytes`);
    console.log(`   📝 Content: "${downloadedContent}"`);
    
    // Test 4: Get file metadata
    console.log('\n4️⃣ Testing file metadata...');
    const metadata = await firebaseStorageService.getFileMetadata(testJobId, testFilename);
    console.log('✅ File metadata retrieved successfully!');
    console.log(`   📅 Created: ${metadata.timeCreated}`);
    console.log(`   📏 Size: ${metadata.size} bytes`);
    console.log(`   🏷️ Content Type: ${metadata.contentType}`);
    
    // Test 5: Get download URL
    console.log('\n5️⃣ Testing download URL generation...');
    const downloadUrl = await firebaseStorageService.getDownloadUrl(testJobId, testFilename);
    console.log('✅ Download URL generated successfully!');
    console.log(`   🔗 URL: ${downloadUrl}`);
    
    // Test 6: Delete the test file
    console.log('\n6️⃣ Testing file deletion...');
    const deleteResult = await firebaseStorageService.deleteFile(testJobId, testFilename);
    
    if (deleteResult) {
      console.log('✅ File deleted successfully!');
    } else {
      console.log('❌ Failed to delete file');
    }
    
    console.log('\n🎉 All Firebase Storage tests passed!');
    
  } catch (error) {
    console.error('❌ Firebase Storage test failed:', error);
    throw error;
  }
}

// Run the test
testFirebaseStorage()
  .then(() => {
    console.log('✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
