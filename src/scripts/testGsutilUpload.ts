import { jobService } from '../services/jobService.js';
import { externalApiService } from '../services/externalApiService.js';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';

async function testGsutilUpload() {
  try {
    console.log('🚀 Starting gsutil upload test...');

    // Create a test video file (1MB of zeros)
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.ensureDir(tempDir);
    const testVideoPath = path.join(tempDir, 'test_video.mp4');
    const oneMB = 1024 * 1024;
    await fs.writeFile(testVideoPath, Buffer.alloc(oneMB, 0));
    console.log('📝 Created test video file:', testVideoPath);

    // Upload to external API
    console.log('📤 Uploading to external API...');
    const formData = new FormData();
    formData.append('file', fs.createReadStream(testVideoPath), {
      filename: 'test_video.mp4',
      contentType: 'video/mp4'
    });
    formData.append('format', 'mp4');
    formData.append('quality', 'high');
    formData.append('processingType', 'enhance');

    const uploadResponse = await externalApiService.uploadVideo(
      await fs.readFile(testVideoPath),
      {
        format: 'mp4',
        quality: 'high',
        processingType: 'enhance'
      }
    );

    console.log('✅ Upload successful:', uploadResponse);
    const jobId = uploadResponse.job_id;

    // Create job in our backend
    console.log('📝 Creating job in backend...');
    const job = await jobService.createJob({
      job_id: jobId,
      metadata: {
        client_name: 'Test Client',
        bike_model: 'Test Bike',
        type: 'analysis'
      }
    });

    console.log('✅ Job created:', job);
    console.log('⏳ Waiting for job to complete...');

    // Poll for job completion
    let jobDetails;
    let isComplete = false;
    while (!isComplete) {
      jobDetails = await externalApiService.getJobDetails(jobId);
      const status = typeof jobDetails.status === 'string' ? jobDetails.status : jobDetails.status.status;
      const progress = typeof jobDetails.status === 'string' ? null : jobDetails.status.progress;
      const message = typeof jobDetails.status === 'string' ? null : jobDetails.status.message;
      
      console.log(`📊 Job status: ${status}${progress ? ` (${progress}%)` : ''}${message ? ` - ${message}` : ''}`);
      
      if (status === 'completed') {
        isComplete = true;
      } else {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
      }
    }

    // Create job again to download files
    console.log('✅ Job completed, downloading files...');
    await jobService.createJob({
      job_id: jobId,
      metadata: {
        client_name: 'Test Client',
        bike_model: 'Test Bike',
        type: 'analysis'
      }
    });

    console.log('⏳ Waiting for files to be uploaded to Google Storage...');

    // Clean up temp file
    await fs.remove(testVideoPath);
    console.log('🧹 Cleaned up test video file');

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testGsutilUpload();
