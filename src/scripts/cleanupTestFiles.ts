import { firebaseStorageService } from '../services/firebaseStorageService.js';
import dotenv from 'dotenv';

dotenv.config();

async function cleanupTestFiles(jobId?: string) {
  console.log('🗑️ Cleaning up test files from Google Cloud Storage bucket...');
  
  if (!jobId) {
    console.log('❌ Please provide a job ID to clean up');
    console.log('Usage: npm run cleanup-test-files <job-id>');
    console.log('Example: npm run cleanup-test-files test-job-1758723895337');
    process.exit(1);
  }
  
  console.log(`🆔 Cleaning up files for job: ${jobId}`);
  
  try {
    // List files first
    console.log('📋 Listing files to be deleted...');
    const files = await firebaseStorageService.listJobFiles(jobId);
    
    if (files.length === 0) {
      console.log('ℹ️ No files found for this job ID');
      return;
    }
    
    console.log(`📁 Found ${files.length} files to delete:`);
    files.forEach((file, index) => {
      console.log(`  ${index + 1}. ${file.filename} (${file.size} bytes)`);
    });
    
    // Delete all files for the job
    console.log('\n🗑️ Deleting files...');
    const deleted = await firebaseStorageService.deleteJobFiles(jobId);
    
    if (deleted) {
      console.log(`✅ Successfully deleted ${files.length} files for job ${jobId}`);
    } else {
      console.log('❌ Failed to delete some files');
    }
    
  } catch (error) {
    console.error('❌ Error cleaning up test files:', error);
  }
}

// Get job ID from command line arguments
const jobId = process.argv[2];

// Run the cleanup
cleanupTestFiles(jobId).then(() => {
  console.log('\n✨ Cleanup completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Cleanup crashed:', error);
  process.exit(1);
});
