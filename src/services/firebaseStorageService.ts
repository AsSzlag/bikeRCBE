import { firebaseAdmin } from '../config/firebase.js';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase Storage
const bucket = firebaseAdmin.storage().bucket(process.env.STORAGE_BUCKET_NAME || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`);

export interface FirebaseFile {
  filename: string;
  downloadUrl: string;
  size: number;
  mimeType?: string;
  uploadedAt: Date;
  path: string;
}

export interface UploadResult {
  filename: string;
  downloadUrl: string;
  size: number;
  mimeType?: string;
  path: string;
}

class FirebaseStorageService {
  private bucketName = process.env.STORAGE_BUCKET_NAME || 'bikerc-files';

  /**
   * Upload a file to Firebase Storage
   */
      async uploadFile(
        fileBuffer: Buffer | NodeJS.ReadableStream, 
        jobId: string, 
        filename: string, 
        mimeType?: string
      ): Promise<UploadResult> {
        try {
          console.log(`Uploading file to Firebase Storage: ${filename} for job ${jobId}`);
          
          // Create a reference to the file in Firebase Storage
          const filePath = `jobs/${jobId}/${filename}`;
          const fileRef = bucket.file(filePath);

          // Create write stream
          const writeStream = fileRef.createWriteStream({
            metadata: {
              contentType: mimeType || 'application/octet-stream',
              metadata: {
                jobId: jobId,
                uploadedAt: new Date().toISOString(),
              }
            },
            resumable: false // For better performance with small files
          });

          // Upload the file
          if (Buffer.isBuffer(fileBuffer)) {
            // If it's a buffer, write it directly
            writeStream.end(fileBuffer);
          } else {
            // If it's a stream, pipe it
            fileBuffer.pipe(writeStream);
          }

          // Wait for upload to complete
          await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
          });

          // Get the download URL
          const [downloadUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
          });

          // Get file metadata
          const [metadata] = await fileRef.getMetadata();

          console.log(`File uploaded successfully: ${filename} (${metadata.size} bytes)`);

          return {
            filename,
            downloadUrl: downloadUrl,
            size: typeof metadata.size === 'string' ? parseInt(metadata.size) : metadata.size || 0,
            mimeType: metadata.contentType,
            path: filePath,
          };
    } catch (error) {
      console.error(`Error uploading file ${filename} to Firebase Storage:`, error);
      throw error;
    }
  }

  /**
   * Download a file from Firebase Storage
   */
  async downloadFile(jobId: string, filename: string): Promise<Buffer> {
    try {
      console.log(`Downloading file from Firebase Storage: ${filename} for job ${jobId}`);
      
      const filePath = `jobs/${jobId}/${filename}`;
      const fileRef = bucket.file(filePath);

      // Download the file as a buffer
      const [fileBuffer] = await fileRef.download();

      console.log(`File downloaded successfully: ${filename} (${fileBuffer.length} bytes)`);
      return fileBuffer;
    } catch (error) {
      console.error(`Error downloading file ${filename} from Firebase Storage:`, error);
      throw error;
    }
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(jobId: string, filename: string): Promise<string> {
    try {
      const filePath = `jobs/${jobId}/${filename}`;
      const fileRef = bucket.file(filePath);

      const [downloadUrl] = await fileRef.getSignedUrl({
        action: 'read',
        expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
      });

      return downloadUrl;
    } catch (error) {
      console.error(`Error getting download URL for ${filename}:`, error);
      throw error;
    }
  }

  /**
   * List all files for a job
   */
  async listJobFiles(jobId: string): Promise<FirebaseFile[]> {
    try {
      console.log(`Listing files for job ${jobId} in Firebase Storage`);
      
      const folderRef = bucket.file(`jobs/${jobId}/`);
      const [files] = await bucket.getFiles({
        prefix: `jobs/${jobId}/`,
      });

      const fileList: FirebaseFile[] = [];

      for (const file of files) {
        try {
          const [metadata] = await file.getMetadata();
          const [downloadUrl] = await file.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
          });

          fileList.push({
            filename: metadata.name?.split('/').pop() || metadata.name || 'unknown',
            downloadUrl: downloadUrl,
            size: typeof metadata.size === 'string' ? parseInt(metadata.size) : metadata.size || 0,
            mimeType: metadata.contentType,
            uploadedAt: new Date(metadata.timeCreated || new Date()),
            path: metadata.name || '',
          });
        } catch (fileError) {
          console.error(`Error getting metadata for file ${file.name}:`, fileError);
        }
      }

      console.log(`Found ${fileList.length} files for job ${jobId}`);
      return fileList;
    } catch (error) {
      console.error(`Error listing files for job ${jobId}:`, error);
      return [];
    }
  }

  /**
   * Delete a file from Firebase Storage
   */
  async deleteFile(jobId: string, filename: string): Promise<boolean> {
    try {
      console.log(`Deleting file from Firebase Storage: ${filename} for job ${jobId}`);
      
      const filePath = `jobs/${jobId}/${filename}`;
      const fileRef = bucket.file(filePath);

      await fileRef.delete();
      console.log(`File deleted successfully: ${filename}`);
      return true;
    } catch (error) {
      console.error(`Error deleting file ${filename}:`, error);
      return false;
    }
  }

  /**
   * Delete all files for a job
   */
  async deleteJobFiles(jobId: string): Promise<boolean> {
    try {
      console.log(`Deleting all files for job ${jobId} from Firebase Storage`);
      
      const [files] = await bucket.getFiles({
        prefix: `jobs/${jobId}/`,
      });

      const deletePromises = files.map(file => file.delete());
      await Promise.all(deletePromises);

      console.log(`Deleted ${files.length} files for job ${jobId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting files for job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Create an empty folder for a job
   */
  async createJobFolder(jobId: string, metadata?: Record<string, any>): Promise<void> {
    try {
      console.log(`Creating folder for job ${jobId} in Firebase Storage`);
      
      // Create a links.json file to store download URLs
      const folderPath = `jobs/${jobId}/links.json`;
      const fileRef = bucket.file(folderPath);

      // Create content for links.json
      const content = {
        jobId: jobId,
        createdAt: new Date().toISOString(),
        ...metadata // Store all provided metadata
      };

      // Upload the JSON content
      await fileRef.save(Buffer.from(JSON.stringify(content, null, 2)), {
        metadata: {
          contentType: 'application/json',
          metadata: {
            jobId: jobId,
            createdAt: new Date().toISOString()
          }
        }
      });

      console.log(`✅ Created links.json for job ${jobId}${metadata ? ' with metadata' : ''}`);
    } catch (error) {
      console.error(`Error creating links.json for job ${jobId}:`, error);
      throw error;
    }
  }

      /**
       * Get file metadata
       */
      async getFileMetadata(jobId: string, filename: string): Promise<any> {
        try {
          const filePath = `jobs/${jobId}/${filename}`;
          const fileRef = bucket.file(filePath);

          const [metadata] = await fileRef.getMetadata();
          return metadata;
        } catch (error) {
          console.error(`Error getting metadata for ${filename}:`, error);
          throw error;
        }
      }

      /**
       * Get file info after gsutil upload
       */
      async getFileInfo(jobId: string, filename: string): Promise<UploadResult> {
        try {
          const filePath = `jobs/${jobId}/${filename}`;
          const fileRef = bucket.file(filePath);

          // Get the download URL
          const [downloadUrl] = await fileRef.getSignedUrl({
            action: 'read',
            expires: Date.now() + 1000 * 60 * 60 * 24 * 365, // 1 year
          });

          // Get file metadata
          const [metadata] = await fileRef.getMetadata();

          return {
            filename,
            downloadUrl: downloadUrl,
            size: typeof metadata.size === 'string' ? parseInt(metadata.size) : metadata.size || 0,
            mimeType: metadata.contentType,
            path: filePath,
          };
        } catch (error) {
          console.error(`Error getting file info for ${filename}:`, error);
          throw error;
        }
      }
}

export const firebaseStorageService = new FirebaseStorageService();
