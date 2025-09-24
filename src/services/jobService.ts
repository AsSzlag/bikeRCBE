import { db, firebaseAdmin } from '../config/firebase.js';
import { Job, CreateJobRequest, UpdateJobRequest } from '../types/job.js';
import { externalApiService, VideoProcessingJob, DownloadedFile, EXTERNAL_API_BASE_URL } from './externalApiService.js';
import { firebaseStorageService } from './firebaseStorageService.js';
import fs from 'fs-extra';
import path from 'path';

class JobService {
  private collection = 'jobs';

  async createJob(jobData: CreateJobRequest): Promise<Job> {
    // Check if job already exists
    const existingJob = await this.getJobByJobId(jobData.job_id);
    if (existingJob) {
      throw new Error(`Job with job_id ${jobData.job_id} already exists`);
    }

    const now = new Date();
    const job: Omit<Job, 'id'> = {
      job_id: jobData.job_id,
      status: 'pending',
      created_at: now,
      updated_at: now,
      metadata: jobData.metadata || {},
    };

    // Create job in database
    const docRef = await db.collection(this.collection).add(job);
    const createdJob = { id: docRef.id, ...job };

    // Wait 3 seconds before checking job details
    console.log(`⏳ Waiting 3 seconds before checking job ${jobData.job_id}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log(`✅ Done waiting, now checking job ${jobData.job_id}`);

    try {
      // Check job status
      const jobDetails = await externalApiService.getJobDetails(jobData.job_id);
      console.log(`📊 Job status: ${jobDetails.status}`);

      // Log full job details to understand the structure
      console.log('📊 Full job details:', JSON.stringify(jobDetails, null, 2));

      // Process files from job details
      const files = jobDetails.files;
      console.log('📂 Files from job details:', files);

      // Process download URLs
      console.log('📁 Processing download URLs');
      const downloadUrls = jobDetails.download_urls;
      const filesUrls = jobDetails.files as Record<string, any> | undefined;
      console.log('📁 Download URLs:', downloadUrls);
      console.log('📁 Files URLs:', filesUrls);
      console.log('📁 Angles CSV URLs:', filesUrls?.angles_csv);

      // Download and upload files
      const uploadedFiles = [];

      // Try to download video and CSV
      const filesToDownload: Array<{
        url: string;
        filename: string;
        mimeType: string;
      }> = [];

      if (jobDetails) {
        // Use direct video download endpoint
        const videoUrl = `${EXTERNAL_API_BASE_URL}/api/download/video/${jobData.job_id}`;
        console.log('🔗 Using video download endpoint:', videoUrl);
        filesToDownload.push({
          url: videoUrl,
          filename: 'processed_video.mp4',
          mimeType: 'video/mp4'
        });

        // Check for CSV in download_urls and files
        console.log('📊 Checking CSV sources:');
        console.log('- download_urls:', jobDetails.download_urls);
        console.log('- files:', jobDetails.files);
        
        // Try to get CSV URL from various sources
        let csvUrl = null;
        
        // 1. Try direct CSV endpoint
        csvUrl = `${EXTERNAL_API_BASE_URL}/api/download/csv/${jobData.job_id}`;
        console.log('1️⃣ Direct CSV endpoint:', csvUrl);
        
        // 2. Try download_urls.csv or csv_direct
        if (jobDetails.download_urls && typeof jobDetails.download_urls === 'object' && !Array.isArray(jobDetails.download_urls)) {
          const urls = jobDetails.download_urls as { csv?: string; csv_direct?: string };
          if (urls.csv) {
            csvUrl = urls.csv;
            console.log('2️⃣ Found CSV in download_urls.csv:', csvUrl);
          } else if (urls.csv_direct) {
            csvUrl = urls.csv_direct;
            console.log('3️⃣ Found CSV in download_urls.csv_direct:', csvUrl);
          }
        }
        
        // 3. Try files.angles_csv
        if (jobDetails.files && typeof jobDetails.files === 'object' && !Array.isArray(jobDetails.files)) {
          const files = jobDetails.files as Record<string, any>;
          if (files.angles_csv?.path) {
            csvUrl = files.angles_csv.path;
            console.log('4️⃣ Found CSV in files.angles_csv:', csvUrl);
          }
        }

        console.log('🎯 Final CSV URL:', csvUrl);
        
        if (csvUrl && typeof csvUrl === 'string') {
          filesToDownload.push({
            url: csvUrl,
            filename: 'angles.csv',
            mimeType: 'text/csv'
          });
        } else {
          console.log('⚠️ No valid CSV URL found');
        }
      }

      console.log('🔗 Files to download:', filesToDownload);

      // Download and upload each file
      for (const file of filesToDownload) {
        try {
          const fullUrl = file.url.startsWith('http') ? file.url : `${EXTERNAL_API_BASE_URL}${file.url}`;
          console.log(`📥 Downloading ${file.filename} from ${fullUrl}`);
          const downloadedFile = await externalApiService.downloadFile(
            fullUrl,
            jobData.job_id,
            `${jobData.job_id}_${file.filename}`
          );

          // Upload to Google bucket using gsutil
          console.log(`📤 Uploading ${file.filename} to Google bucket using gsutil...`);
          const bucketName = process.env.STORAGE_BUCKET_NAME || 'bikerc-storage';
          const gsutilCommand = `curl "${fullUrl}" | gsutil cp - gs://${bucketName}/jobs/${jobData.job_id}/${file.filename}`;
          console.log('🔧 Running command:', gsutilCommand);
          
          const uploadResult = await new Promise<any>((resolve, reject) => {
            const child = require('child_process').exec(gsutilCommand, async (error: any, stdout: string, stderr: string) => {
              if (error) {
                console.error('❌ gsutil error:', error);
                console.error('stderr:', stderr);
                reject(error);
                return;
              }
              console.log('✅ gsutil output:', stdout);
              
              try {
                // Get file info from Google Storage
                const fileInfo = await firebaseStorageService.getFileInfo(
                  jobData.job_id,
                  file.filename
                );
                resolve(fileInfo);
              } catch (infoError) {
                reject(infoError);
              }
            });
          });

          console.log(`✅ File uploaded to bucket: ${uploadResult.filename}`);
          
          uploadedFiles.push({
            filename: uploadResult.filename,
            size: uploadResult.size,
            mimeType: uploadResult.mimeType,
            downloadUrl: uploadResult.downloadUrl,
            originalUrl: fullUrl,
            bucketPath: uploadResult.path
          });

        } catch (uploadError) {
          console.error(`❌ Error uploading ${file.filename} to bucket:`, uploadError);
        }
      }

      // Create links.json with file info
      const linksJson = {
        timestamp: new Date().toISOString(),
        // Download URLs from API response
        downloadUrls: downloadUrls || {},
        // Files we've uploaded to bucket
        uploadedFiles: uploadedFiles.map(file => ({
          filename: file.filename,
          size: file.size,
          mimeType: file.mimeType,
          downloadUrl: file.downloadUrl,
          originalUrl: file.originalUrl,
          bucketPath: file.bucketPath
        })),
        // Statistics
        stats: {
          totalFiles: uploadedFiles.length,
          videoUploaded: uploadedFiles.some(f => f.mimeType === 'video/mp4'),
          csvUploaded: uploadedFiles.some(f => f.mimeType === 'text/csv')
        }
      };
      console.log('📄 links.json content:', JSON.stringify(linksJson, null, 2));
      await firebaseStorageService.uploadFile(
        Buffer.from(JSON.stringify(linksJson, null, 2)),
        jobData.job_id,
        'links.json',
        'application/json'
      );

      // Handle both string and object status
      const statusObj = typeof jobDetails.status === 'string' 
        ? { status: jobDetails.status as 'pending' | 'processing' | 'completed' | 'failed' } 
        : jobDetails.status;
      const status = statusObj.status;
      console.log(`📊 Job status: ${status}`);

      // Always update job with all available details
      const metadata: any = {
        ...job.metadata,
        external_status: status,
        last_check: new Date().toISOString(),
      };

      // Add fields only if they exist
      if (statusObj.progress !== undefined) metadata.progress = statusObj.progress;
      if (statusObj.message) metadata.message = statusObj.message;
      if (jobDetails.job_id) metadata.job_id = jobDetails.job_id;
      if (jobDetails.filename) metadata.filename = jobDetails.filename;
      if (jobDetails.estimated_wait_time) metadata.estimated_wait_time = jobDetails.estimated_wait_time;
      if (jobDetails.queue_position) metadata.queue_position = jobDetails.queue_position;
      if (jobDetails.inputUrl) metadata.inputUrl = jobDetails.inputUrl;
      if (jobDetails.outputUrl) metadata.outputUrl = jobDetails.outputUrl;
      if (jobDetails.createdAt) metadata.createdAt = jobDetails.createdAt;
      if (jobDetails.updatedAt) metadata.updatedAt = jobDetails.updatedAt;
      if (jobDetails.error) metadata.error = jobDetails.error;
      if (jobDetails.analysis_results) metadata.analysis_results = jobDetails.analysis_results;
      if (jobDetails.is_current_processing !== undefined) metadata.is_current_processing = jobDetails.is_current_processing;
      if (jobDetails.troubleshooting) metadata.troubleshooting = jobDetails.troubleshooting;
      if (jobDetails.download_urls) metadata.download_urls = jobDetails.download_urls;

      // Handle files object
      if (jobDetails.files && typeof jobDetails.files === 'object' && !Array.isArray(jobDetails.files)) {
        metadata.files = Object.entries(jobDetails.files as Record<string, {
          path: string;
          exists: boolean;
          size: number;
        }>).map(([key, value]) => {
          const file: any = {
            filename: key,
            size: value.size || 0,
            downloadUrl: `/api/files/${job.job_id}/${key}`,
            originalUrl: value.path,
            bucketPath: `jobs/${job.job_id}/${key}`
          };
          if (value.exists) {
            file.mimeType = 'video/mp4';
          }
          return file;
        });
      }

      const updateData: UpdateJobRequest = {
        metadata
      };

      // If job is completed, download and store files
      if (status === 'completed') {
        console.log(`✅ Job ${jobData.job_id} is completed, downloading files...`);
        
        // Get job details with files
        const result = await this.fetchJobDetailsAndFiles(jobData.job_id);
        
        // Add file information to metadata
        updateData.status = 'completed';
        updateData.metadata = {
          ...updateData.metadata,
          files_downloaded: result.downloadedFiles.length,
          download_errors: result.downloadErrors.length,
          completed_at: new Date().toISOString(),
          files: result.downloadedFiles.map(file => ({
            filename: file.filename,
            size: file.size,
            mimeType: file.mimeType,
            downloadUrl: `/api/files/${jobData.job_id}/${file.filename}`,
            originalUrl: file.originalUrl,
          }))
        };
      }

      // Update job with all available information
      await this.updateJob(createdJob.id, updateData);
    } catch (error) {
      console.error(`Error checking job ${jobData.job_id}:`, error);
      // Don't throw error - we still want to return the created job
    }
    
    return createdJob;
  }

  async getJob(id: string): Promise<Job | null> {
    const doc = await db.collection(this.collection).doc(id).get();
    
    if (!doc.exists) {
      return null;
    }

    return {
      id: doc.id,
      ...doc.data(),
    } as Job;
  }

  async getJobByJobId(job_id: string): Promise<Job | null> {
    const snapshot = await db.collection(this.collection)
      .where('job_id', '==', job_id)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return null;
    }

    const doc = snapshot.docs[0];
    return {
      id: doc.id,
      ...doc.data(),
    } as Job;
  }

  async getRecentJobs(limit: number = 50): Promise<Job[]> {
    const snapshot = await db.collection(this.collection)
      .orderBy('created_at', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Job[];
  }

  async updateJob(id: string, updateData: UpdateJobRequest): Promise<Job | null> {
    const updateFields: any = {
      updated_at: new Date(),
    };

    if (updateData.status) {
      updateFields.status = updateData.status;
    }

    if (updateData.metadata) {
      updateFields.metadata = updateData.metadata;
    }

    await db.collection(this.collection).doc(id).update(updateFields);
    
    return this.getJob(id);
  }

  async deleteJob(id: string): Promise<boolean> {
    try {
      await db.collection(this.collection).doc(id).delete();
      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      return false;
    }
  }

  async getJobsByStatus(status: Job['status']): Promise<Job[]> {
    // First try with orderBy (requires index)
    try {
      const snapshot = await db.collection(this.collection)
        .where('status', '==', status)
        .orderBy('created_at', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Job[];
    } catch (error) {
      // If index doesn't exist, fall back to simple query without orderBy
      console.log(`Index not found for status query, falling back to simple query. Error: ${error}`);
      
      const snapshot = await db.collection(this.collection)
        .where('status', '==', status)
        .get();

      // Sort manually in memory
      const jobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Job[];

      return jobs.sort((a, b) => {
        // Handle both Date objects and Firestore Timestamps
        const aTime = a.created_at instanceof firebaseAdmin.firestore.Timestamp 
          ? a.created_at.toDate().getTime() 
          : a.created_at instanceof Date 
            ? a.created_at.getTime() 
            : new Date(a.created_at).getTime();
        const bTime = b.created_at instanceof firebaseAdmin.firestore.Timestamp 
          ? b.created_at.toDate().getTime() 
          : b.created_at instanceof Date 
            ? b.created_at.getTime() 
            : new Date(b.created_at).getTime();
        return bTime - aTime; // Descending order (newest first)
      });
    }
  }

  /**
   * Get pending jobs that are newer than 5 minutes but older than 5 seconds (for aggressive polling)
   */
  async getRecentPendingJobs(maxAgeMinutes: number = 5, minAgeSeconds: number = 5): Promise<Job[]> {
    const maxCutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    const minCutoffTime = new Date(Date.now() - minAgeSeconds * 1000);
    
    try {
      // First try with orderBy (requires index)
      const snapshot = await db.collection(this.collection)
        .where('status', '==', 'pending')
        .where('created_at', '>', maxCutoffTime)
        .orderBy('created_at', 'desc')
        .get();

      // Filter out jobs marked to stop polling and jobs too new (less than 5 seconds old)
      const jobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Job[];

      return jobs.filter(job => {
        const jobTime = job.created_at instanceof Date ? job.created_at : job.created_at.toDate();
        const isOldEnough = jobTime <= minCutoffTime; // Job must be at least 5 seconds old
        const shouldStopPolling = job.metadata?.stop_polling === true;
        return isOldEnough && !shouldStopPolling;
      });
    } catch (error) {
      // If index doesn't exist, fall back to simple query and filter in memory
      console.log(`Index not found for recent pending jobs query, falling back to simple query. Error: ${error}`);
      
      const snapshot = await db.collection(this.collection)
        .where('status', '==', 'pending')
        .get();

      // Filter and sort manually in memory
      const jobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Job[];

      // Filter jobs newer than max cutoff time, older than min cutoff time, and not marked to stop polling
      const recentJobs = jobs.filter(job => {
        const jobTime = job.created_at instanceof Date ? job.created_at : job.created_at.toDate();
        const isRecent = jobTime > maxCutoffTime; // Job must be newer than 5 minutes
        const isOldEnough = jobTime <= minCutoffTime; // Job must be at least 5 seconds old
        const shouldStopPolling = job.metadata?.stop_polling === true;
        return isRecent && isOldEnough && !shouldStopPolling;
      });

      // Sort by creation time (newest first)
      return recentJobs.sort((a, b) => {
        const aTime = a.created_at instanceof Date ? a.created_at.getTime() : a.created_at.toDate().getTime();
        const bTime = b.created_at instanceof Date ? b.created_at.getTime() : b.created_at.toDate().getTime();
        return bTime - aTime;
      });
    }
  }

  /**
   * Mark old pending jobs as failed (cleanup method)
   */
  async markOldPendingJobsAsFailed(maxAgeMinutes: number = 10): Promise<number> {
    const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
    
    try {
      // Get all pending jobs
      const snapshot = await db.collection(this.collection)
        .where('status', '==', 'pending')
        .get();

      const jobs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Job[];

      // Filter old jobs
      const oldJobs = jobs.filter(job => {
        const jobTime = job.created_at instanceof Date ? job.created_at : job.created_at.toDate();
        return jobTime <= cutoffTime;
      });

      if (oldJobs.length === 0) {
        console.log('ℹ️ No old pending jobs found to mark as failed');
        return 0;
      }

      console.log(`🧹 Found ${oldJobs.length} old pending jobs to mark as failed`);

      // Mark each old job as failed
      let markedCount = 0;
      for (const job of oldJobs) {
        try {
          await this.updateJob(job.id, {
            status: 'failed',
            metadata: {
              ...job.metadata,
              error_message: `Job marked as failed after ${maxAgeMinutes} minutes without completion`,
              marked_failed_at: new Date().toISOString(),
            }
          });
          markedCount++;
          console.log(`❌ Marked old job ${job.job_id} as failed`);
        } catch (error) {
          console.error(`Error marking job ${job.job_id} as failed:`, error);
        }
      }

      console.log(`✅ Marked ${markedCount} old pending jobs as failed`);
      return markedCount;
    } catch (error) {
      console.error('❌ Error marking old pending jobs as failed:', error);
      return 0;
    }
  }

  /**
   * Fetch job details from external API and download all files
   */
  async fetchJobDetailsAndFiles(jobId: string): Promise<{
    jobDetails: VideoProcessingJob;
    downloadedFiles: DownloadedFile[];
    downloadErrors: string[];
  }> {
    try {
      console.log(`Fetching job details and files for job_id: ${jobId}`);
      
      // Get job from database to find the external job_id
      const job = await this.getJobByJobId(jobId);
      if (!job) {
        throw new Error(`Job with job_id ${jobId} not found in database`);
      }

      // Fetch details and download files from external API
      const result = await externalApiService.getJobDetailsWithFiles(jobId);
      
      // Upload files to Google bucket
      const uploadedFiles = [];
      for (const file of result.downloadedFiles) {
        try {
          // Upload to Google bucket directly from stream
          console.log(`📤 Uploading ${file.filename} to Google bucket...`);
          const uploadResult = await firebaseStorageService.uploadFile(
            file.stream,
            jobId,
            file.filename,
            file.mimeType
          );
          console.log(`✅ File uploaded to bucket: ${uploadResult.filename}`);
          
          uploadedFiles.push({
            filename: uploadResult.filename,
            size: uploadResult.size,
            mimeType: uploadResult.mimeType,
            downloadUrl: uploadResult.downloadUrl,
            originalUrl: file.originalUrl,
            bucketPath: uploadResult.path
          });
        } catch (uploadError) {
          console.error(`❌ Error uploading ${file.filename} to bucket:`, uploadError);
          result.downloadErrors.push(`Failed to upload ${file.filename} to bucket: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
        }
      }

      // Update job status in database with file information
      await this.updateJob(job.id, {
        status: typeof result.jobDetails.status === 'string' ? result.jobDetails.status as 'pending' | 'processing' | 'completed' | 'failed' : result.jobDetails.status.status,
        metadata: {
          ...job.metadata,
          external_status: typeof result.jobDetails.status === 'string' ? result.jobDetails.status : result.jobDetails.status.status,
          files_downloaded: result.downloadedFiles.length,
          files_uploaded: uploadedFiles.length,
          files: uploadedFiles,
          download_urls: result.jobDetails.download_urls,
          last_fetch: new Date().toISOString(),
        }
      });

      console.log(`Successfully processed ${uploadedFiles.length} files for job ${jobId}`);
      return {
        jobDetails: result.jobDetails,
        downloadedFiles: result.downloadedFiles,
        downloadErrors: result.downloadErrors
      };
    } catch (error) {
      console.error(`Error processing job details and files for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get job details from external API (without downloading files)
   */
  async getJobDetailsFromExternal(jobId: string): Promise<VideoProcessingJob> {
    try {
      console.log(`Fetching job details from external API for job_id: ${jobId}`);
      return await externalApiService.getJobDetails(jobId);
    } catch (error) {
      console.error(`Error fetching job details from external API for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get list of downloaded files for a job
   */
  async getJobFiles(jobId: string): Promise<DownloadedFile[]> {
    try {
      return await externalApiService.getJobFiles(jobId);
    } catch (error) {
      console.error(`Error getting files for job ${jobId}:`, error);
      return [];
    }
  }

  /**
   * Delete all downloaded files for a job
   */
  async deleteJobFiles(jobId: string): Promise<boolean> {
    try {
      return await externalApiService.deleteJobFiles(jobId);
    } catch (error) {
      console.error(`Error deleting files for job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Get job with all associated data (details + files)
   */
  async getJobWithDetails(jobId: string): Promise<{
    job: Job | null;
    externalDetails: VideoProcessingJob | null;
    downloadedFiles: DownloadedFile[];
  }> {
    try {
      const job = await this.getJobByJobId(jobId);
      let externalDetails: VideoProcessingJob | null = null;
      let downloadedFiles: DownloadedFile[] = [];

      if (job) {
        try {
          externalDetails = await this.getJobDetailsFromExternal(jobId);
        } catch (error) {
          console.warn(`Could not fetch external details for job ${jobId}:`, error);
        }

        try {
          downloadedFiles = await this.getJobFiles(jobId);
        } catch (error) {
          console.warn(`Could not fetch files for job ${jobId}:`, error);
        }
      }

      return {
        job,
        externalDetails,
        downloadedFiles,
      };
    } catch (error) {
      console.error(`Error getting job with details for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Get files for a job from database metadata
   */
  async getJobFilesFromDatabase(jobId: string): Promise<any[]> {
    try {
      const job = await this.getJobByJobId(jobId);
      if (!job) {
        return [];
      }

      // Return files from database metadata
      return job.metadata?.files || [];
    } catch (error) {
      console.error(`Error getting job files from database for ${jobId}:`, error);
      return [];
    }
  }

  /**
   * Get all jobs with pagination
   */
  async getJobsWithPagination(page: number = 1, limit: number = 10, orderBy: string = 'created_at', orderDirection: 'asc' | 'desc' = 'desc'): Promise<{
    jobs: Job[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * limit;
      
      // Get all jobs first (Firestore doesn't have native offset)
      const allSnapshot = await db.collection(this.collection)
        .orderBy(orderBy, orderDirection)
        .get();
      
      const allJobs = allSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Job[];
      
      const total = allJobs.length;
      
      // Apply pagination
      const paginatedJobs = allJobs.slice(offset, offset + limit);
      
      return {
        jobs: paginatedJobs,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      console.error('Error getting all jobs:', error);
      throw error;
    }
  }

  /**
   * Get job by database ID with file information
   */
  async getJobByIdWithFiles(id: string): Promise<{
    job: Job | null;
    files: any[];
  }> {
    try {
      const job = await this.getJob(id);
      if (!job) {
        return { job: null, files: [] };
      }

      // Get files from database metadata
      const files = job.metadata?.files || [];

      return {
        job,
        files,
      };
    } catch (error) {
      console.error(`Error getting job by ID with files for ${id}:`, error);
      throw error;
    }
  }
}

export { JobService };
