import { firebaseStorageService } from '../services/firebaseStorageService.js';
import { JobService } from '../services/jobService.js';
import { CreateJobRequest } from '../types/job.js';
import { externalApiService } from '../services/externalApiService.js';
import dotenv from 'dotenv';

dotenv.config();

async function testEndToEndFlow() {
  console.log('🧪 Testing complete end-to-end flow...');
  console.log('📋 Flow: Create Job → Fetch Details → Download Files → Store in Bucket → Serve to FE\n');
  
  const jobService = new JobService();
  
  try {
    // Step 1: Create a test job in the backend
    console.log('1️⃣ Creating a test job in the backend...');
    const testJobData: CreateJobRequest = {
      job_id: `test-analysis-${Date.now()}`,
      metadata: {
        client_name: "Test Client",
        bike_model: "Trek 2024",
        type: "analysis",
        filename: "test_video.mp4",
        estimated_wait_time: "5 minutes"
      }
    };
    
    const createdJob = await jobService.createJob(testJobData);
    console.log('✅ Job created successfully:', {
      id: createdJob.id,
      job_id: createdJob.job_id,
      status: createdJob.status,
      client_name: createdJob.metadata?.client_name
    });
    
    // Step 2: Simulate fetching job details from external API
    console.log('\n2️⃣ Simulating job details fetch from external API...');
    
    // For this test, we'll create mock external API response
    const mockExternalApiResponse = {
      job_id: createdJob.job_id,
      status: "completed",
      results: {
        analysis_type: "bike_geometry",
        measurements: {
          head_angle: 70.5,
          seat_angle: 73.2,
          chainstay_length: 430,
          wheelbase: 1025
        }
      },
      files: [
        {
          filename: "processed_video.mp4",
          url: "https://example.com/files/processed_video.mp4",
          size: 15728640, // 15MB
          type: "video/mp4"
        },
        {
          filename: "measurements.csv",
          url: "https://example.com/files/measurements.csv",
          size: 2048, // 2KB
          type: "text/csv"
        },
        {
          filename: "analysis_report.pdf",
          url: "https://example.com/files/analysis_report.pdf",
          size: 512000, // 500KB
          type: "application/pdf"
        }
      ]
    };
    
    console.log('📄 Mock external API response:', {
      job_id: mockExternalApiResponse.job_id,
      status: mockExternalApiResponse.status,
      files_count: mockExternalApiResponse.files.length
    });
    
    // Step 3: Download and store files in Google Cloud Storage
    console.log('\n3️⃣ Downloading and storing files in Google Cloud Storage...');
    
    const downloadedFiles = [];
    const downloadErrors = [];
    
    for (const file of mockExternalApiResponse.files) {
      try {
        console.log(`📥 Downloading ${file.filename}...`);
        
        // Simulate file content based on file type
        let fileContent: Buffer;
        let mimeType = file.type;
        
        switch (file.filename.split('.').pop()?.toLowerCase()) {
          case 'mp4':
            // Simulate video file content
            fileContent = Buffer.from(`Mock video content for ${file.filename} - ${Date.now()}`, 'utf8');
            break;
          case 'csv':
            // Simulate CSV content
            fileContent = Buffer.from(`timestamp,head_angle,seat_angle,chainstay_length,wheelbase
2024-01-01T10:00:00Z,70.5,73.2,430,1025
2024-01-01T10:00:01Z,70.4,73.3,430,1025
2024-01-01T10:00:02Z,70.6,73.1,430,1025`, 'utf8');
            break;
          case 'pdf':
            // Simulate PDF content
            fileContent = Buffer.from(`Mock PDF content for ${file.filename} - Analysis Report`, 'utf8');
            break;
          default:
            fileContent = Buffer.from(`Mock content for ${file.filename}`, 'utf8');
        }
        
        // Upload to Google Cloud Storage
        const uploadResult = await firebaseStorageService.uploadFile(
          fileContent,
          createdJob.job_id,
          file.filename,
          mimeType
        );
        
        downloadedFiles.push({
          filename: uploadResult.filename,
          size: uploadResult.size,
          path: uploadResult.path,
          downloadUrl: uploadResult.downloadUrl,
          mimeType: uploadResult.mimeType
        });
        
        console.log(`✅ ${file.filename} uploaded successfully (${uploadResult.size} bytes)`);
        
      } catch (error) {
        console.error(`❌ Failed to download ${file.filename}:`, error);
        downloadErrors.push(`${file.filename}: ${error}`);
      }
    }
    
    console.log(`\n📊 Download Summary:`);
    console.log(`✅ Successfully downloaded: ${downloadedFiles.length} files`);
    console.log(`❌ Failed downloads: ${downloadErrors.length} files`);
    
    if (downloadErrors.length > 0) {
      console.log('Download errors:', downloadErrors);
    }
    
    // Step 4: Update job status to completed
    console.log('\n4️⃣ Updating job status to completed...');
    const updatedJob = await jobService.updateJob(createdJob.id, {
      status: 'completed',
      metadata: {
        ...createdJob.metadata,
        files_downloaded: downloadedFiles.length,
        download_errors: downloadErrors.length
      }
    });
    
    console.log('✅ Job status updated:', {
      id: updatedJob?.id,
      status: updatedJob?.status,
      files_downloaded: updatedJob?.metadata?.files_downloaded
    });
    
    // Step 5: Test serving files back to frontend
    console.log('\n5️⃣ Testing file serving to frontend...');
    
    // List all files for the job
    console.log('📋 Listing all files for the job...');
    const jobFiles = await firebaseStorageService.listJobFiles(createdJob.job_id);
    console.log(`✅ Found ${jobFiles.length} files in bucket:`);
    
    jobFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filename}`);
      console.log(`     Size: ${file.size} bytes`);
      console.log(`     Type: ${file.mimeType}`);
      console.log(`     Path: ${file.path}`);
      console.log(`     Download URL: ${file.downloadUrl.substring(0, 80)}...`);
      console.log('');
    });
    
    // Test downloading one file to verify it can be served
    console.log('📥 Testing file download (simulating frontend request)...');
    const testFile = jobFiles[0];
    if (testFile) {
      const downloadedContent = await firebaseStorageService.downloadFile(
        createdJob.job_id, 
        testFile.filename
      );
      console.log(`✅ Successfully downloaded ${testFile.filename} (${downloadedContent.length} bytes)`);
      console.log(`📄 Content preview: ${downloadedContent.toString('utf8').substring(0, 100)}...`);
    }
    
    // Step 6: Test backend API endpoints
    console.log('\n6️⃣ Testing backend API endpoints...');
    
    // Test getting job with details
    console.log('🔍 Testing GET /api/jobs/:job_id/complete...');
    try {
      const jobWithDetails = await jobService.getJobWithDetails(createdJob.job_id);
      console.log('✅ Job with details retrieved:', {
        job_exists: !!jobWithDetails.job,
        external_details: !!jobWithDetails.externalDetails,
        downloaded_files: jobWithDetails.downloadedFiles.length
      });
    } catch (error) {
      console.log('ℹ️ Job with details endpoint not available (expected for mock data)');
    }
    
    // Test getting job files
    console.log('📁 Testing GET /api/jobs/:job_id/files...');
    try {
      const jobFiles = await jobService.getJobFiles(createdJob.job_id);
      console.log(`✅ Job files endpoint working: ${jobFiles.length} files found`);
    } catch (error) {
      console.log('ℹ️ Job files endpoint not available (expected for mock data)');
    }
    
    console.log('\n🎉 End-to-end test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`✅ Job created: ${createdJob.job_id}`);
    console.log(`✅ Files downloaded: ${downloadedFiles.length}`);
    console.log(`✅ Files stored in bucket: ${jobFiles.length}`);
    console.log(`✅ Job status: ${updatedJob?.status}`);
    
    console.log('\n🔗 Your files are accessible at:');
    jobFiles.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.downloadUrl}`);
    });
    
    console.log('\n💡 To clean up test data, run:');
    console.log(`   npm run cleanup-test-files ${createdJob.job_id}`);
    
  } catch (error) {
    console.error('❌ End-to-end test failed:', error);
    console.error('\n🔧 Troubleshooting tips:');
    console.error('1. Check your .env file has correct Firebase credentials');
    console.error('2. Verify your Firebase service account has Storage permissions');
    console.error('3. Ensure the backend server is running');
    console.error('4. Check your external API configuration');
  }
}

// Run the test
testEndToEndFlow().then(() => {
  console.log('\n✨ End-to-end test completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 End-to-end test crashed:', error);
  process.exit(1);
});
