import fs from 'fs-extra';
import path from 'path';
import { firebaseStorageService } from '../services/firebaseStorageService.js';

/**
 * Migration script to move local files to Firebase Storage
 */
async function migrateLocalFilesToFirebaseStorage() {
  const uploadsDir = path.join(process.cwd(), 'uploads');
  
  if (!await fs.pathExists(uploadsDir)) {
    console.log('No uploads directory found. Nothing to migrate.');
    return;
  }

  const jobDirs = await fs.readdir(uploadsDir);
  console.log(`Found ${jobDirs.length} job directories to migrate`);

  for (const jobId of jobDirs) {
    const jobDir = path.join(uploadsDir, jobId);
    const stats = await fs.stat(jobDir);
    
    if (!stats.isDirectory()) {
      continue;
    }

    console.log(`\nMigrating files for job: ${jobId}`);
    
    const files = await fs.readdir(jobDir);
    console.log(`Found ${files.length} files in job directory`);

    for (const filename of files) {
      const filePath = path.join(jobDir, filename);
      const fileStats = await fs.stat(filePath);
      
      if (!fileStats.isFile()) {
        continue;
      }

      try {
        console.log(`  Migrating file: ${filename} (${fileStats.size} bytes)`);
        
        // Read the file
        const fileBuffer = await fs.readFile(filePath);
        
        // Upload to Firebase Storage
        const uploadResult = await firebaseStorageService.uploadFile(
          fileBuffer,
          jobId,
          filename,
          'application/octet-stream' // Default MIME type
        );
        
        console.log(`  ✅ Successfully uploaded to Firebase Storage: ${uploadResult.downloadUrl}`);
        
        // Optionally delete the local file after successful upload
        // await fs.remove(filePath);
        // console.log(`  🗑️ Deleted local file: ${filename}`);
        
      } catch (error) {
        console.error(`  ❌ Failed to migrate file ${filename}:`, error);
      }
    }
  }

  console.log('\n🎉 Migration completed!');
}

// Run the migration
migrateLocalFilesToFirebaseStorage()
  .then(() => {
    console.log('Migration script finished');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration script failed:', error);
    process.exit(1);
  });
