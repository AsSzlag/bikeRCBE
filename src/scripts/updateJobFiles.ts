import { JobService } from '../services/jobService.js';
import { externalApiService } from '../services/externalApiService.js';

/**
 * Script to update existing jobs with file information
 */
async function updateJobFiles() {
  const jobService = new JobService();
  
  console.log('🔄 Updating existing jobs with file information...');
  
  try {
    // Get all jobs
    const result = await jobService.getJobsWithPagination(1, 100);
    console.log(`Found ${result.total} jobs to update`);
    
    for (const job of result.jobs) {
      console.log(`\n📋 Processing job: ${job.job_id} (${job.id})`);
      
      // Get files from local storage
      const files = await externalApiService.getJobFiles(job.job_id);
      console.log(`  Found ${files.length} files in local storage`);
      
      if (files.length > 0) {
        // Prepare file information for database storage
        const filesInfo = files.map(file => {
          const fileInfo: any = {
            filename: file.filename,
            size: file.size,
            downloadUrl: `/api/files/${job.job_id}/${file.filename}`,
          };
          
          // Only add properties that are not undefined
          if (file.mimeType) {
            fileInfo.mimeType = file.mimeType;
          }
          if (file.originalUrl) {
            fileInfo.originalUrl = file.originalUrl;
          }
          
          return fileInfo;
        });
        
        // Update job with file information
        await jobService.updateJob(job.id, {
          metadata: {
            ...job.metadata,
            files: filesInfo,
            files_downloaded: files.length,
            last_file_update: new Date().toISOString(),
          }
        });
        
        console.log(`  ✅ Updated job with ${filesInfo.length} files`);
        filesInfo.forEach(file => {
          console.log(`    📄 ${file.filename} (${file.size} bytes) - ${file.downloadUrl}`);
        });
      } else {
        console.log(`  ⚠️  No files found for this job`);
      }
    }
    
    console.log('\n🎉 Job file update completed!');
    
  } catch (error) {
    console.error('❌ Error updating job files:', error);
    throw error;
  }
}

// Run the update
updateJobFiles()
  .then(() => {
    console.log('✅ Update script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Update script failed:', error);
    process.exit(1);
  });
