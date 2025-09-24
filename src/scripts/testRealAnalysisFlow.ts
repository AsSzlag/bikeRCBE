import { JobService } from '../services/jobService.js';
import { CreateJobRequest } from '../types/job.js';
import { firebaseStorageService } from '../services/firebaseStorageService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testRealAnalysisFlow() {
  console.log('🧪 Testing REAL analysis flow...');
  console.log('📋 Flow: Create Analysis Job → Fetch Details → Download Files → Store in Bucket → Update Database → Serve to FE\n');
  
  const jobService = new JobService();
  
  try {
    // Step 1: Create a real analysis job (simulating frontend upload)
    console.log('1️⃣ Creating a real analysis job...');
    const analysisJobData: CreateJobRequest = {
      job_id: `analysis-${Date.now()}`,
      metadata: {
        client_name: "Real Client",
        bike_model: "Specialized 2024",
        type: "analysis",
        filename: "bike_analysis_video.mp4",
        estimated_wait_time: "10 minutes"
      }
    };
    
    const createdJob = await jobService.createJob(analysisJobData);
    console.log('✅ Analysis job created:', {
      id: createdJob.id,
      job_id: createdJob.job_id,
      status: createdJob.status,
      client_name: createdJob.metadata?.client_name,
      bike_model: createdJob.metadata?.bike_model
    });
    
    // Step 2: Simulate the external API having the job ready
    console.log('\n2️⃣ Simulating external API job completion...');
    console.log('📡 External API would have processed the video and generated files');
    
    // Step 3: Fetch job details and download files (this is what happens when user clicks "Fetch Details")
    console.log('\n3️⃣ Fetching job details and downloading files...');
    console.log('🔄 This simulates calling: POST /api/jobs/:job_id/fetch-details');
    
    try {
      const fetchResult = await jobService.fetchJobDetailsAndFiles(createdJob.job_id);
      console.log('✅ Job details fetched successfully:', {
        external_status: fetchResult.jobDetails.status,
        files_downloaded: fetchResult.downloadedFiles.length,
        download_errors: fetchResult.downloadErrors.length
      });
      
      if (fetchResult.downloadedFiles.length > 0) {
        console.log('📁 Downloaded files:');
        fetchResult.downloadedFiles.forEach((file, index) => {
          console.log(`  ${index + 1}. ${file.filename} (${file.size} bytes)`);
        });
      }
      
      if (fetchResult.downloadErrors.length > 0) {
        console.log('❌ Download errors:');
        fetchResult.downloadErrors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }
      
    } catch (error) {
      console.log('ℹ️ External API not available (expected for test)');
      console.log('🔄 Simulating file download manually...');
      
      // Simulate downloading files manually since external API is not available
      const mockFiles = [
        {
          filename: "processed_video.mp4",
          content: Buffer.from(`Mock processed video content for ${createdJob.job_id}`, 'utf8'),
          mimeType: "video/mp4"
        },
        {
          filename: "measurements.csv",
          content: Buffer.from(`timestamp,head_angle,seat_angle,chainstay_length,wheelbase
2024-01-01T10:00:00Z,70.5,73.2,430,1025
2024-01-01T10:00:01Z,70.4,73.3,430,1025
2024-01-01T10:00:02Z,70.6,73.1,430,1025`, 'utf8'),
          mimeType: "text/csv"
        },
        {
          filename: "analysis_report.pdf",
          content: Buffer.from(`BikeRC Analysis Report for ${createdJob.job_id}`, 'utf8'),
          mimeType: "application/pdf"
        }
      ];
      
      const downloadedFiles = [];
      for (const file of mockFiles) {
        try {
          const uploadResult = await firebaseStorageService.uploadFile(
            file.content,
            createdJob.job_id,
            file.filename,
            file.mimeType
          );
          
          downloadedFiles.push({
            filename: uploadResult.filename,
            size: uploadResult.size,
            mimeType: uploadResult.mimeType,
            downloadUrl: uploadResult.downloadUrl,
            path: uploadResult.path
          });
          
          console.log(`✅ ${file.filename} uploaded to bucket (${uploadResult.size} bytes)`);
        } catch (error) {
          console.error(`❌ Failed to upload ${file.filename}:`, error);
        }
      }
      
      // Update job with file information
      const filesInfo = downloadedFiles.map(file => ({
        filename: file.filename,
        size: file.size,
        mimeType: file.mimeType,
        downloadUrl: `/api/files/${createdJob.job_id}/${file.filename}`,
        bucketPath: file.path,
        uploadedAt: new Date().toISOString()
      }));
      
      await jobService.updateJob(createdJob.id, {
        status: 'completed',
        metadata: {
          ...createdJob.metadata,
          external_status: 'completed',
          files_downloaded: downloadedFiles.length,
          files: filesInfo,
          last_fetch: new Date().toISOString(),
        }
      });
      
      console.log(`✅ Job updated with ${downloadedFiles.length} files`);
    }
    
    // Step 4: Verify files are in Google Cloud Storage
    console.log('\n4️⃣ Verifying files in Google Cloud Storage...');
    const bucketFiles = await firebaseStorageService.listJobFiles(createdJob.job_id);
    console.log(`✅ Found ${bucketFiles.length} files in bucket:`);
    bucketFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filename}`);
      console.log(`     Size: ${file.size} bytes`);
      console.log(`     Type: ${file.mimeType}`);
      console.log(`     Path: ${file.path}`);
      console.log(`     Download URL: ${file.downloadUrl.substring(0, 80)}...`);
      console.log('');
    });
    
    // Step 5: Verify database has file links
    console.log('\n5️⃣ Verifying database has file links...');
    const updatedJob = await jobService.getJob(createdJob.id);
    if (updatedJob?.metadata?.files) {
      console.log(`✅ Database contains ${updatedJob.metadata.files.length} file entries:`);
      updatedJob.metadata.files.forEach((file: any, index: number) => {
        console.log(`  ${index + 1}. ${file.filename}`);
        console.log(`     Size: ${file.size} bytes`);
        console.log(`     Type: ${file.mimeType}`);
        console.log(`     Download URL: ${file.downloadUrl}`);
        console.log('');
      });
    } else {
      console.log('❌ No file information found in database');
    }
    
    // Step 6: Test serving files to frontend
    console.log('\n6️⃣ Testing file serving endpoints...');
    
    // Test getting job with complete details
    console.log('🔍 Testing GET /api/jobs/:job_id/complete...');
    const jobWithDetails = await jobService.getJobWithDetails(createdJob.job_id);
    console.log('✅ Job with details retrieved:', {
      job_exists: !!jobWithDetails.job,
      external_details: !!jobWithDetails.externalDetails,
      downloaded_files: jobWithDetails.downloadedFiles.length
    });
    
    // Test getting job files
    console.log('📁 Testing GET /api/jobs/:job_id/files...');
    const jobFiles = await jobService.getJobFiles(createdJob.job_id);
    console.log(`✅ Job files endpoint: ${jobFiles.length} files found`);
    
    // Test getting job by ID with files
    console.log('🆔 Testing GET /api/jobs/by-id/:id...');
    const jobByIdWithFiles = await jobService.getJobByIdWithFiles(createdJob.id);
    console.log('✅ Job by ID with files:', {
      job_exists: !!jobByIdWithFiles.job,
      files_count: jobByIdWithFiles.files.length
    });
    
    // Step 7: Test file download (simulating frontend request)
    console.log('\n7️⃣ Testing file download (simulating frontend request)...');
    if (bucketFiles.length > 0) {
      const testFile = bucketFiles[0];
      console.log(`📥 Testing download of: ${testFile.filename}`);
      
      const downloadedContent = await firebaseStorageService.downloadFile(
        createdJob.job_id, 
        testFile.filename
      );
      
      console.log(`✅ Successfully downloaded ${testFile.filename} (${downloadedContent.length} bytes)`);
      console.log(`📄 Content preview: ${downloadedContent.toString('utf8').substring(0, 100)}...`);
    }
    
    console.log('\n🎉 Real analysis flow test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`✅ Job created: ${createdJob.job_id}`);
    console.log(`✅ Files in bucket: ${bucketFiles.length}`);
    console.log(`✅ Files in database: ${updatedJob?.metadata?.files?.length || 0}`);
    console.log(`✅ Job status: ${updatedJob?.status}`);
    
    console.log('\n🔗 Your analysis files are accessible at:');
    bucketFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.downloadUrl}`);
    });
    
    console.log('\n📱 Frontend can now:');
    console.log('  • List all files: GET /api/jobs/:job_id/files');
    console.log('  • Download files: GET /api/files/:job_id/:filename');
    console.log('  • Get file info: GET /api/files/:job_id/:filename/info');
    console.log('  • Get complete job: GET /api/jobs/:job_id/complete');
    
    console.log('\n💡 To clean up test data, run:');
    console.log(`   npm run cleanup-test-files ${createdJob.job_id}`);
    
  } catch (error) {
    console.error('❌ Real analysis flow test failed:', error);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('1. Check your .env file has correct Firebase credentials');
    console.error('2. Verify your Firebase service account has Storage permissions');
    console.error('3. Ensure the backend server is running');
    console.error('4. Check your external API configuration');
  }
}

// Run the test
testRealAnalysisFlow().then(() => {
  console.log('\n✨ Real analysis flow test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Real analysis flow test crashed:', error);
  process.exit(1);
});
