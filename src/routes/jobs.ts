import express from 'express';
import { JobService } from '../services/jobService.js';
// Job processor removed - no longer needed
import { CreateJobRequest, UpdateJobRequest } from '../types/job.js';

const router = express.Router();
const jobService = new JobService();

// Create a new job
router.post('/', async (req, res) => {
  try {
    const jobData: CreateJobRequest = req.body;
    
    if (!jobData.job_id) {
      return res.status(400).json({ 
        error: 'job_id is required' 
      });
    }

    // Check if job_id already exists
    const existingJob = await jobService.getJobByJobId(jobData.job_id);
    if (existingJob) {
      return res.status(409).json({ 
        error: 'Job with this job_id already exists',
        job: existingJob
      });
    }

    const job = await jobService.createJob(jobData);
    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get all jobs
router.get('/', async (req, res) => {
  try {
    const result = await jobService.getJobsWithPagination(1, 1000); // Get all jobs with high limit
    res.json(result.jobs); // Return just the jobs array
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get job by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const job = await jobService.getJob(id);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found' 
      });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get job by job_id
router.get('/job-id/:job_id', async (req, res) => {
  try {
    const { job_id } = req.params;
    const job = await jobService.getJobByJobId(job_id);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found' 
      });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job by job_id:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Update job
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData: UpdateJobRequest = req.body;
    
    const job = await jobService.updateJob(id, updateData);
    
    if (!job) {
      return res.status(404).json({ 
        error: 'Job not found' 
      });
    }

    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Delete job
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const success = await jobService.deleteJob(id);
    
    if (!success) {
      return res.status(404).json({ 
        error: 'Job not found or could not be deleted' 
      });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting job:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Get jobs by status
router.get('/status/:status', async (req, res) => {
  try {
    const { status } = req.params;
    
    if (!['pending', 'processing', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ 
        error: 'Invalid status. Must be one of: pending, processing, completed, failed' 
      });
    }

    const jobs = await jobService.getJobsByStatus(status as any);
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs by status:', error);
    res.status(500).json({ 
      error: 'Internal server error' 
    });
  }
});

// Fetch job details from external API and download all files
router.post('/:job_id/fetch-details', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const result = await jobService.fetchJobDetailsAndFiles(job_id);
    res.json({
      message: 'Job details fetched and files downloaded successfully',
      jobDetails: result.jobDetails,
      downloadedFiles: result.downloadedFiles,
      downloadErrors: result.downloadErrors,
    });
  } catch (error) {
    console.error('Error fetching job details and files:', error);
    res.status(500).json({ 
      error: 'Failed to fetch job details and download files',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job details from external API (without downloading files)
router.get('/:job_id/external-details', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const jobDetails = await jobService.getJobDetailsFromExternal(job_id);
    res.json(jobDetails);
  } catch (error) {
    console.error('Error fetching external job details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch job details from external API',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get job with all associated data (details + files)
router.get('/:job_id/complete', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const result = await jobService.getJobWithDetails(job_id);
    res.json(result);
  } catch (error) {
    console.error('Error getting job with details:', error);
    res.status(500).json({ 
      error: 'Failed to get job with details',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get list of downloaded files for a job
router.get('/:job_id/files', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const files = await jobService.getJobFiles(job_id);
    res.json(files);
  } catch (error) {
    console.error('Error getting job files:', error);
    res.status(500).json({ 
      error: 'Failed to get job files',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete all downloaded files for a job
router.delete('/:job_id/files', async (req, res) => {
  try {
    const { job_id } = req.params;
    
    const success = await jobService.deleteJobFiles(job_id);
    if (success) {
      res.json({ message: 'Job files deleted successfully' });
    } else {
      res.status(404).json({ error: 'No files found for this job' });
    }
  } catch (error) {
    console.error('Error deleting job files:', error);
    res.status(500).json({ 
      error: 'Failed to delete job files',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});


// Get job by database ID with file information
router.get('/by-id/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await jobService.getJobByIdWithFiles(id);
    
    if (!result.job) {
      return res.status(404).json({ error: 'Job not found' });
    }
    
    res.json({
      job: result.job,
      files: result.files,
      fileCount: result.files.length
    });
  } catch (error) {
    console.error('Error getting job by ID:', error);
    res.status(500).json({ 
      error: 'Failed to get job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Job processor endpoints removed - no longer needed

export default router;
