import { firebaseAdmin } from '../config/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

async function createFirestoreIndex() {
  console.log('🔧 Creating Firestore index for job status queries...');
  
  try {
    // The index we need is for: status (ascending) + created_at (descending)
    // This is required for the query: where('status', '==', 'pending').orderBy('created_at', 'desc')
    
    console.log('📋 Index Details:');
    console.log('  Collection: jobs');
    console.log('  Fields:');
    console.log('    - status (Ascending)');
    console.log('    - created_at (Descending)');
    
    console.log('\n🔗 To create this index:');
    console.log('1. Go to Firebase Console: https://console.firebase.google.com/');
    console.log('2. Select your project: bikerc-5a1dd');
    console.log('3. Go to Firestore Database → Indexes');
    console.log('4. Click "Create Index"');
    console.log('5. Set the following:');
    console.log('   - Collection ID: jobs');
    console.log('   - Fields:');
    console.log('     * status (Ascending)');
    console.log('     * created_at (Descending)');
    console.log('6. Click "Create"');
    
    console.log('\n🚀 Alternative: Use the direct link from the error message');
    console.log('The error message contains a direct link to create the index automatically.');
    
    console.log('\n📝 Or use Firebase CLI:');
    console.log('firebase firestore:indexes');
    
    console.log('\n⏱️  Note: Index creation can take a few minutes.');
    console.log('Once created, the job processor will work without the fallback query.');
    
    console.log('\n✅ For now, the system will use a fallback query that works without the index.');
    console.log('This means jobs will still be processed, just without the optimized ordering.');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
createFirestoreIndex().then(() => {
  console.log('\n✨ Index creation guide completed');
  process.exit(0);
}).catch((error) => {
  console.error('💥 Script failed:', error);
  process.exit(1);
});
