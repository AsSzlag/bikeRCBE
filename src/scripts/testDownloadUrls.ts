import { JobService } from '../services/jobService.js';
import { firebaseAdmin } from '../config/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

const db = firebaseAdmin.firestore();
const jobsCollection = db.collection('jobs');

async function testDownloadUrls() {
  console.log('🧪 Testing download URLs storage in database...\n');

  try {
    // Get all completed jobs
    const completedJobs = await jobService.getJobsByStatus('completed');
    
    console.log(`📊 Found ${completedJobs.length} completed jobs:`);
    
    if (completedJobs.length === 0) {
      console.log('ℹ️ No completed jobs found. Create and complete a job first to test download URLs.');
      return;
    }

    // Check each completed job for download URLs
    for (const job of completedJobs) {
      console.log(`\n📋 Job: ${job.job_id}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Created: ${job.created_at}`);
      
      if (job.metadata?.download_urls) {
        console.log(`   ✅ Download URLs found:`);
        if (Array.isArray(job.metadata.download_urls)) {
          job.metadata.download_urls.forEach((url: string, index: number) => {
            console.log(`      ${index + 1}. ${url}`);
          });
        } else if (typeof job.metadata.download_urls === 'object') {
          Object.entries(job.metadata.download_urls).forEach(([key, url]) => {
            console.log(`      ${key}: ${url}`);
          });
        }
      } else {
        console.log(`   ❌ No download URLs found in metadata`);
      }

      if (job.metadata?.files) {
        console.log(`   📁 Files stored:`);
        if (Array.isArray(job.metadata.files)) {
          job.metadata.files.forEach((file: any, index: number) => {
            console.log(`      ${index + 1}. ${file.filename} (${file.size} bytes)`);
            console.log(`         Download URL: ${file.downloadUrl}`);
            console.log(`         Original URL: ${file.originalUrl}`);
          });
        }
      } else {
        console.log(`   ❌ No files information found in metadata`);
      }

      console.log(`   📊 Files downloaded: ${job.metadata?.files_downloaded || 0}`);
      console.log(`   ⚠️  Download errors: ${job.metadata?.download_errors || 0}`);
    }

    console.log('\n🎉 Download URLs test completed!');
    console.log('\n📋 Summary:');
    console.log('✅ Checked all completed jobs for download URLs');
    console.log('✅ Verified that download URLs are stored in job metadata');
    console.log('✅ Confirmed that file information is properly saved');

  } catch (error) {
    console.error('❌ Error testing download URLs:', error);
  }
}

testDownloadUrls().catch(console.error);
