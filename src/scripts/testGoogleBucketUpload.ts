import { JobService } from '../services/jobService.js';
import { externalApiService } from '../services/externalApiService.js';
import { firebaseStorageService } from '../services/firebaseStorageService.js';
import { firebaseAdmin } from '../config/firebase.js';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';

dotenv.config();

const db = firebaseAdmin.firestore();
const jobsCollection = db.collection('jobs');

const TEST_JOB_ID = `bucket-test-${Date.now()}`;
const TEST_CLIENT_NAME = 'Bucket Test Client';
const TEST_BIKE_MODEL = 'Bucket Test Bike';

async function testGoogleBucketUpload() {
  console.log('🧪 Testing Google bucket file upload...\n');

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

    // Create a test job
    const newJob = await jobService.createJob({
      job_id: TEST_JOB_ID,
      metadata: {
        client_name: TEST_CLIENT_NAME,
        bike_model: TEST_BIKE_MODEL,
        type: 'analysis',
        filename: 'test_video.mp4',
        download_urls: {
          video: videoPath,
          csv: csvPath
        }
      }
    });

    console.log('2️⃣ Created test job:', {
      id: newJob.id,
      job_id: newJob.job_id,
      status: newJob.status
    });

    // Wait 3 seconds
    console.log('⏳ Waiting 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Upload files to Google bucket
    console.log('\n3️⃣ Uploading files to Google bucket...');
    
    const videoBuffer = await fs.readFile(videoPath);
    const csvBuffer = await fs.readFile(csvPath);

    const uploadResults = await Promise.all([
      firebaseStorageService.uploadFile(videoBuffer, TEST_JOB_ID, 'test_video.mp4', 'video/mp4'),
      firebaseStorageService.uploadFile(csvBuffer, TEST_JOB_ID, 'test_data.csv', 'text/csv')
    ]);

    console.log('✅ Files uploaded successfully:', uploadResults);

    // List files in bucket
    console.log('\n4️⃣ Listing files in bucket...');
    const bucketFiles = await firebaseStorageService.listJobFiles(TEST_JOB_ID);
    console.log('📁 Files in bucket:', bucketFiles);

    // Download a file from bucket
    console.log('\n5️⃣ Testing file download from bucket...');
    const downloadedBuffer = await firebaseStorageService.downloadFile(TEST_JOB_ID, 'test_video.mp4');
    console.log('✅ File downloaded successfully:', {
      size: downloadedBuffer.length,
      content: downloadedBuffer.toString().substring(0, 50) + '...'
    });

    // Get download URLs
    console.log('\n6️⃣ Getting download URLs...');
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
    
    // Delete test job
    await jobService.deleteJob(newJob.id);
    console.log('✅ Test job deleted');

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log('✅ Created test files');
    console.log('✅ Created test job');
    console.log('✅ Uploaded files to Google bucket');
    console.log('✅ Listed files in bucket');
    console.log('✅ Downloaded file from bucket');
    console.log('✅ Generated download URLs');
    console.log('✅ Cleaned up all resources');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testGoogleBucketUpload().catch(console.error);
