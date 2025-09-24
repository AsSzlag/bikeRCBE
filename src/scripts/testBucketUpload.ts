import { firebaseStorageService } from '../services/firebaseStorageService.js';
import { firebaseAdmin } from '../config/firebase.js';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

dotenv.config();

const TEST_JOB_ID = `bucket-test-${Date.now()}`;

async function testBucketUpload() {
  console.log('🧪 Testing Google bucket upload...\n');

  try {
    // Create test files
    const testDir = path.join(process.cwd(), 'test-files');
    await fs.ensureDir(testDir);

    // Create a test video file
    const videoPath = path.join(testDir, 'test_video.mp4');
    await fs.writeFile(videoPath, 'Test video content');

    // Create a test CSV file
    const csvPath = path.join(testDir, 'test_data.csv');
    await fs.writeFile(csvPath, 'timestamp,angle\n1,45\n2,90\n3,135');

    console.log('1️⃣ Created test files:', {
      video: videoPath,
      csv: csvPath
    });

    // Upload files to Google bucket
    console.log('\n2️⃣ Uploading files to Google bucket...');
    
    const videoBuffer = await fs.readFile(videoPath);
    const csvBuffer = await fs.readFile(csvPath);

    const uploadResults = await Promise.all([
      firebaseStorageService.uploadFile(videoBuffer, TEST_JOB_ID, 'test_video.mp4', 'video/mp4'),
      firebaseStorageService.uploadFile(csvBuffer, TEST_JOB_ID, 'test_data.csv', 'text/csv')
    ]);

    console.log('✅ Files uploaded successfully:', uploadResults);

    // List files in bucket
    console.log('\n3️⃣ Listing files in bucket...');
    const bucketFiles = await firebaseStorageService.listJobFiles(TEST_JOB_ID);
    console.log('📁 Files in bucket:', bucketFiles);

    // Download a file from bucket
    console.log('\n4️⃣ Testing file download from bucket...');
    const downloadedBuffer = await firebaseStorageService.downloadFile(TEST_JOB_ID, 'test_video.mp4');
    console.log('✅ File downloaded successfully:', {
      size: downloadedBuffer.length,
      content: downloadedBuffer.toString().substring(0, 50) + '...'
    });

    // Get download URLs
    console.log('\n5️⃣ Getting download URLs...');
    const videoUrl = await firebaseStorageService.getDownloadUrl(TEST_JOB_ID, 'test_video.mp4');
    const csvUrl = await firebaseStorageService.getDownloadUrl(TEST_JOB_ID, 'test_data.csv');
    console.log('📥 Download URLs:', {
      video: videoUrl,
      csv: csvUrl
    });

    // Clean up
    console.log('\n🧹 Cleaning up...');
    
    // Delete files from bucket
    await firebaseStorageService.deleteJobFiles(TEST_JOB_ID);
    console.log('✅ Files deleted from bucket');
    
    // Delete test files
    await fs.remove(testDir);
    console.log('✅ Local test files deleted');

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Created test files');
    console.log('✅ Uploaded files to Google bucket');
    console.log('✅ Listed files in bucket');
    console.log('✅ Downloaded file from bucket');
    console.log('✅ Generated download URLs');
    console.log('✅ Cleaned up all resources');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testBucketUpload().catch(console.error);
