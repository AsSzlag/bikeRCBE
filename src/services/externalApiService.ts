import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import FormData from 'form-data';
import { JobStatus } from '../types/job.js';

// External API configuration (your current API)
export const EXTERNAL_API_BASE_URL = 'https://api-mo2s.netrix.com.pl';

const externalApi = axios.create({
  baseURL: EXTERNAL_API_BASE_URL,
  timeout: 30000, // 30 seconds timeout for file downloads
  headers: {
    'Content-Type': 'application/json',
    'accept': 'application/json',
  },
});

// Types matching your frontend VideoProcessingJob interface
export interface VideoProcessingJob {
  id?: string;
  job_id: string;
  filename?: string;
  message?: string;
  estimated_wait_time?: string;
  queue_position?: number;
  status: string | JobStatus;
  inputUrl?: string;
  outputUrl?: string;
  progress?: number;
  createdAt?: string;
  updatedAt?: string;
  error?: string;
  files?: Array<{
    filename: string;
    size: number;
    mimeType?: string;
    downloadUrl: string;
    originalUrl: string;
    bucketPath: string;
  }>;
  links?: string[];
  analysis_results?: Record<string, unknown>;
  download_urls?: string[] | Record<string, string> | {
    download_page?: string;
    video?: string;
    video_direct?: string;
    csv?: string;
    csv_direct?: string;
  };
  // Additional fields from actual API response
  completed_at?: string;
  is_current_processing?: boolean;
  troubleshooting?: Record<string, any>;
}

export interface DownloadedFile {
  filename: string;
  stream: NodeJS.ReadableStream;
  originalUrl: string;
  size: number;
  mimeType?: string;
}

export interface JobDetailsWithFiles {
  jobDetails: VideoProcessingJob;
  downloadedFiles: DownloadedFile[];
  downloadErrors: string[];
}

class ExternalApiService {
  private uploadsDir = path.join(process.cwd(), 'uploads');

  constructor() {
    // Ensure uploads directory exists
    this.ensureUploadsDirectory();
  }

  private async ensureUploadsDirectory() {
    try {
      await fs.ensureDir(this.uploadsDir);
      console.log('Uploads directory ensured:', this.uploadsDir);
    } catch (error) {
      console.error('Error creating uploads directory:', error);
    }
  }

  /**
   * Upload video to external API
   */
  async uploadVideo(file: Buffer, options: {
    format: 'mp4' | 'avi' | 'mov';
    quality: 'low' | 'medium' | 'high';
    processingType: 'enhance';
  }): Promise<VideoProcessingJob> {
    try {
      // Create a temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      await fs.ensureDir(tempDir);
      const tempFile = path.join(tempDir, 'test_video.' + options.format);
      await fs.writeFile(tempFile, file);

      // Create form data
      const formData = new FormData();
      formData.append('file', fs.createReadStream(tempFile), {
        filename: 'test_video.' + options.format,
        contentType: 'video/' + options.format
      });
      formData.append('format', options.format);
      formData.append('quality', options.quality);
      formData.append('processingType', options.processingType);

      try {
        const response = await externalApi.post('/api/upload', formData, {
          headers: {
            ...formData.getHeaders(),
            'Accept': 'application/json'
          }
        });
        return response.data;
      } finally {
        // Clean up temp file
        await fs.remove(tempFile);
      }
    } catch (error) {
      console.error('Error uploading video:', error);
      throw error;
    }
  }

  /**
   * Fetch job details from external API
   */
  async getJobDetails(jobId: string): Promise<VideoProcessingJob> {
    try {
      console.log(`Fetching job details for job_id: ${jobId}`);
      const response = await externalApi.get(`/api/job/${jobId}/details`);
      console.log('Job details fetched successfully:', response.data);
      return response.data;
    } catch (error) {
      console.error(`Error fetching job details for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Download a single file from URL to local storage
   */
      async downloadFile(url: string, jobId: string, filename: string): Promise<DownloadedFile> {
        try {
          console.log(`Downloading file: ${filename} from ${url}`);
          
          // Handle both direct URLs and API endpoints
          let downloadUrl = url;
          if (url.startsWith('/api/')) {
            // Convert relative API path to full URL
            downloadUrl = `${EXTERNAL_API_BASE_URL}${url}`;
            console.log(`🔄 Converting relative URL to full URL: ${url} -> ${downloadUrl}`);
          } else if (url.includes('localhost:8000')) {
            // Convert localhost URLs to the external API base URL
            const oldUrl = url;
            downloadUrl = url.replace('http://localhost:8000', EXTERNAL_API_BASE_URL);
            console.log(`🔄 Converting localhost URL to external URL: ${oldUrl} -> ${downloadUrl}`);
          } else {
            console.log(`✅ Using direct URL: ${downloadUrl}`);
          }
          
          const response = await externalApi.get(downloadUrl, {
            responseType: 'stream', // Use stream for direct piping
            timeout: 60000, // 60 seconds for file download
          });

          // Get content length if available
          const size = parseInt(response.headers['content-length'] || '0', 10);
          const mimeType = response.headers['content-type'] || 'video/mp4';
          
          console.log(`Starting download: ${filename} (${size} bytes, ${mimeType})`);
          
          return {
            filename: this.sanitizeFilename(filename),
            stream: response.data,
            originalUrl: url,
            size,
            mimeType,
          };
    } catch (error) {
      console.error(`Error downloading file ${filename}:`, error);
      throw error;
    }
  }

  /**
   * Download all files from job details
   */
  async downloadJobFiles(jobId: string, jobDetails: VideoProcessingJob): Promise<DownloadedFile[]> {
    const downloadedFiles: DownloadedFile[] = [];
    const downloadPromises: Promise<DownloadedFile | null>[] = [];

      // Download files from files array
      if (jobDetails.files && Array.isArray(jobDetails.files) && jobDetails.files.length > 0) {
        for (const file of jobDetails.files) {
          if (!file.downloadUrl) continue;
          downloadPromises.push(
            this.downloadFile(file.downloadUrl, jobId, file.filename).catch(error => {
              console.error(`Failed to download file ${file.filename}:`, error);
              return null; // Don't throw error, just skip this file
            })
          );
        }
      }

    // Download files from download_urls object
    if (jobDetails.download_urls && typeof jobDetails.download_urls === 'object' && !Array.isArray(jobDetails.download_urls)) {
      const downloadUrls = jobDetails.download_urls;

      // Try to download video
      if ('video' in downloadUrls && downloadUrls.video) {
        const videoUrl = downloadUrls.video;
        console.log(`Downloading video from: ${videoUrl}`);
        downloadPromises.push(
          this.downloadFile(videoUrl, jobId, `${jobId}_processed_video.mp4`).catch(error => {
            console.error(`Failed to download video:`, error);
            // If direct URL fails, try video_direct
            if ('video_direct' in downloadUrls && downloadUrls.video_direct) {
              console.log(`Trying video_direct URL: ${downloadUrls.video_direct}`);
              return this.downloadFile(downloadUrls.video_direct, jobId, `${jobId}_processed_video.mp4`).catch(error => {
                console.error(`Failed to download video from direct URL:`, error);
                return null;
              });
            }
            return null;
          })
        );
      }

      // Try to download CSV
      if ('csv' in downloadUrls && downloadUrls.csv) {
        const csvUrl = downloadUrls.csv;
        console.log(`Downloading CSV from: ${csvUrl}`);
        downloadPromises.push(
          this.downloadFile(csvUrl, jobId, `${jobId}_angles.csv`).catch(error => {
            console.error(`Failed to download CSV:`, error);
            // If direct URL fails, try csv_direct
            if ('csv_direct' in downloadUrls && downloadUrls.csv_direct) {
              console.log(`Trying csv_direct URL: ${downloadUrls.csv_direct}`);
              return this.downloadFile(downloadUrls.csv_direct, jobId, `${jobId}_angles.csv`).catch(error => {
                console.error(`Failed to download CSV from direct URL:`, error);
                return null;
              });
            }
            return null;
          })
        );
      }
    }

    // Download files from links array
    if (jobDetails.links && Array.isArray(jobDetails.links) && jobDetails.links.length > 0) {
      for (const fileUrl of jobDetails.links) {
        const filename = this.extractFilenameFromUrl(fileUrl);
        downloadPromises.push(
          this.downloadFile(fileUrl, jobId, filename).catch(error => {
            console.error(`Failed to download file ${filename}:`, error);
            throw error;
          })
        );
      }
    }

    // Wait for all downloads to complete
    if (downloadPromises.length > 0) {
      try {
        const results = await Promise.all(downloadPromises);
        
        // Filter out null results (failed downloads)
        for (const result of results) {
          if (result !== null) {
            downloadedFiles.push(result);
          }
        }
      } catch (error) {
        console.error('Error in batch download:', error);
      }
    }

    console.log(`Downloaded ${downloadedFiles.length} files for job ${jobId}`);
    return downloadedFiles;
  }

  /**
   * Get job details and download all associated files
   */
  async getJobDetailsWithFiles(jobId: string): Promise<JobDetailsWithFiles> {
    try {
      console.log(`Getting job details and files for job_id: ${jobId}`);
      
      // Fetch job details
      const jobDetails = await this.getJobDetails(jobId);
      
      // Download all files
      const downloadedFiles = await this.downloadJobFiles(jobId, jobDetails);
      
      return {
        jobDetails,
        downloadedFiles,
        downloadErrors: [], // Could be enhanced to track specific download errors
      };
    } catch (error) {
      console.error(`Error getting job details with files for ${jobId}:`, error);
      throw error;
    }
  }

  /**
   * Extract filename from URL
   */
  private extractFilenameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = path.basename(pathname);
      
      // If no filename in URL, generate one
      if (!filename || filename === '/') {
        const timestamp = Date.now();
        return `file_${timestamp}.bin`;
      }
      
      return filename;
    } catch (error) {
      console.error('Error extracting filename from URL:', error);
      return `file_${Date.now()}.bin`;
    }
  }

  /**
   * Sanitize filename for safe storage
   */
  private sanitizeFilename(filename: string): string {
    // Remove or replace unsafe characters
    return filename
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_|_$/g, '');
  }

  /**
   * Get list of downloaded files for a job
   */
      async getJobFiles(jobId: string): Promise<DownloadedFile[]> {
        // This method is no longer used as we stream files directly
        return [];
      }

  /**
   * Delete all files for a job
   */
  async deleteJobFiles(jobId: string): Promise<boolean> {
    try {
      const jobDir = path.join(this.uploadsDir, jobId);
      
      if (await fs.pathExists(jobDir)) {
        await fs.remove(jobDir);
        console.log(`Deleted all files for job ${jobId}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error deleting files for job ${jobId}:`, error);
      return false;
    }
  }
}

export const externalApiService = new ExternalApiService();
