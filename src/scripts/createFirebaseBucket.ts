import { firebaseAdmin } from '../config/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Script to create Firebase Storage bucket
 */
async function createFirebaseBucket() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const bucketName = `${projectId}.appspot.com`;
  
  console.log(`Creating Firebase Storage bucket: ${bucketName}`);
  
  try {
    const storage = firebaseAdmin.storage();
    
    // Check if bucket already exists
    const [exists] = await storage.bucket(bucketName).exists();
    
    if (exists) {
      console.log(`✅ Bucket ${bucketName} already exists!`);
      return;
    }
    
    // Create the bucket
    const [bucket] = await storage.createBucket(bucketName, {
      location: 'us-central1', // You can change this to your preferred location
      storageClass: 'STANDARD',
    });
    
    console.log(`✅ Successfully created bucket: ${bucketName}`);
    console.log(`📍 Location: ${bucket.metadata.location}`);
    console.log(`📦 Storage class: ${bucket.metadata.storageClass}`);
    
    // Set bucket permissions (make it publicly readable for downloads)
    await bucket.iam.setPolicy({
      bindings: [
        {
          role: 'roles/storage.objectViewer',
          members: ['allUsers'],
        },
      ],
    });
    
    console.log(`🔓 Set public read permissions for bucket`);
    
  } catch (error) {
    console.error('❌ Error creating bucket:', error);
    throw error;
  }
}

// Run the script
createFirebaseBucket()
  .then(() => {
    console.log('🎉 Bucket creation completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Bucket creation failed:', error);
    process.exit(1);
  });
