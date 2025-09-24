import { JobService } from '../services/jobService.js';
import { externalApiService } from '../services/externalApiService.js';
import { firebaseStorageService } from '../services/firebaseStorageService.js';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';

dotenv.config();

const jobService = new JobService();


async function testRealJob() {
  console.log('🧪 Testing real job processing...\n');

  try {
    // Create a test video file
    const testDir = path.join(process.cwd(), 'test-files');
    await fs.ensureDir(testDir);
    const videoPath = path.join(testDir, 'test_video.mp4');
    
    // Create a 10-second video file with black frames
    const videoSize = 1024 * 1024; // 1MB
    const buffer = Buffer.alloc(videoSize);
    buffer.fill(0); // Fill with zeros (black frames)
    await fs.writeFile(videoPath, buffer);

    // Create a job in external API
    console.log('1️⃣ Creating job in external API...');
    const videoBuffer = await fs.readFile(videoPath);
    const externalJob = await externalApiService.uploadVideo(videoBuffer, {
      format: 'mp4',
      quality: 'high',
      processingType: 'enhance'
    });
    const jobId = externalJob.job_id;
    console.log('✅ External job created:', externalJob);

    // Store job in our backend
    console.log('\n2️⃣ Storing job in backend...');
    const job = await jobService.createJob({
      job_id: jobId,
      metadata: {
        client_name: 'Test Client',
        bike_model: 'Test Bike',
        type: 'analysis',
        filename: 'test_video.mp4'
      }
    });

    console.log('✅ Job created:', {
      id: job.id,
      job_id: job.job_id,
      status: job.status,
      metadata: job.metadata
    });

    // Monitor job status
    console.log('\n3️⃣ Monitoring job status...');
    let isComplete = false;
    let attempts = 0;
    const maxAttempts = 10;
    const delaySeconds = 5;

    while (!isComplete && attempts < maxAttempts) {
      attempts++;
      console.log(`\nAttempt ${attempts}/${maxAttempts}:`);

      // Get job details from external API
      const jobDetails = await externalApiService.getJobDetails(jobId);
      console.log('📊 Job status:', typeof jobDetails.status === 'string' ? jobDetails.status : jobDetails.status.status);
      
      if (typeof jobDetails.status === 'object') {
        console.log('📈 Progress:', jobDetails.status.progress);
        console.log('💬 Message:', jobDetails.status.message);
      }

      // Check job status and troubleshooting info
      const status = typeof jobDetails.status === 'string' ? jobDetails.status : jobDetails.status.status;
      const troubleshooting = jobDetails.troubleshooting;

      if (troubleshooting && !troubleshooting.can_download_video && !troubleshooting.can_download_csv && !troubleshooting.processing_completed) {
        console.log('\n❌ Files not ready for download yet:');
        console.log('- Video downloadable:', troubleshooting.can_download_video);
        console.log('- CSV downloadable:', troubleshooting.can_download_csv);
        console.log('- Processing completed:', troubleshooting.processing_completed);
        console.log('- Has errors:', troubleshooting.has_errors);
        console.log('- Queue position:', troubleshooting.queue_position);
        break;
      }

      if (status === 'completed') {
        isComplete = true;
        console.log('\n✅ Job completed!');
        
        // Get job details with files
        console.log('\n4️⃣ Downloading and storing files...');
        const result = await jobService.fetchJobDetailsAndFiles(jobId);
        
        console.log('\n📁 Downloaded files:', result.downloadedFiles.map(file => ({
          filename: file.filename,
          size: file.size,
          mimeType: file.mimeType
        })));

        // List files in bucket
        console.log('\n5️⃣ Verifying files in bucket...');
        const bucketFiles = await firebaseStorageService.listJobFiles(jobId);
        console.log('📦 Files in bucket:', bucketFiles);

        break;
      } else {
        console.log(`⏳ Job not complete yet, waiting ${delaySeconds} seconds...`);
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
      }
    }

    if (!isComplete) {
      console.log('\n❌ Job did not complete within the maximum attempts');
    }

    // Get final job state from database
    console.log('\n6️⃣ Final job state in database:');
    const finalJob = await jobService.getJobByJobId(jobId);
    console.log('📝 Job:', {
      id: finalJob?.id,
      job_id: finalJob?.job_id,
      status: finalJob?.status,
      metadata: finalJob?.metadata
    });

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRealJob().catch(console.error);
