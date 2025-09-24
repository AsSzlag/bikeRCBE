export interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  message?: string;
}

export interface Job {
  id: string;
  job_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date | firebaseAdmin.firestore.Timestamp;
  updated_at: Date | firebaseAdmin.firestore.Timestamp;
  metadata?: {
    client_name?: string;
    bike_model?: string;
    type?: 'measurement' | 'analysis';
    filename?: string;
    estimated_wait_time?: string;
    queue_position?: number;
    // External API fields
    external_status?: string;
    external_error?: string;
    error_message?: string;
    completed_at?: string;
    last_check?: string;
    last_fetch?: string;
    stop_polling?: boolean;
    download_urls?: Record<string, string> | string[];
    files?: Array<{
      filename: string;
      size: number;
      mimeType?: string;
      downloadUrl: string;
      originalUrl?: string;
      bucketPath?: string;
    }>;
    files_downloaded?: number;
    files_uploaded?: number;
    download_errors?: number;
    marked_failed_at?: string;
    // Additional fields from external API
    id?: string;
    job_id?: string;
    message?: string;
    status?: string | JobStatus;
    inputUrl?: string;
    outputUrl?: string;
    progress?: number;
    createdAt?: string;
    updatedAt?: string;
    error?: string;
    links?: string[];
    analysis_results?: Record<string, unknown>;
    is_current_processing?: boolean;
    troubleshooting?: Record<string, unknown>;
  };
}

export interface CreateJobRequest {
  job_id: string;
  metadata?: {
    client_name?: string;
    bike_model?: string;
    type?: 'measurement' | 'analysis';
    filename?: string;
    estimated_wait_time?: string;
    queue_position?: number;
    // External API fields
    external_status?: string;
    external_error?: string;
    error_message?: string;
    completed_at?: string;
    last_check?: string;
    last_fetch?: string;
    stop_polling?: boolean;
    download_urls?: Record<string, string> | string[];
    files?: Array<{
      filename: string;
      size: number;
      mimeType?: string;
      downloadUrl: string;
      originalUrl?: string;
      bucketPath?: string;
    }>;
    files_downloaded?: number;
    files_uploaded?: number;
    download_errors?: number;
    marked_failed_at?: string;
    // Additional fields from external API
    id?: string;
    job_id?: string;
    message?: string;
    status?: string;
    inputUrl?: string;
    outputUrl?: string;
    progress?: number;
    createdAt?: string;
    updatedAt?: string;
    error?: string;
    links?: string[];
    analysis_results?: Record<string, unknown>;
    is_current_processing?: boolean;
    troubleshooting?: Record<string, unknown>;
  };
}

export interface UpdateJobRequest {
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  metadata?: Partial<Job['metadata']>;
}
