import express from 'express';
import { firebaseStorageService } from '../services/firebaseStorageService.js';
import { JobService } from '../services/jobService.js';

const router = express.Router();

// Serve downloaded files from Google Cloud Storage
router.get('/:job_id/:filename', async (req, res) => {
  try {
    const { job_id, filename } = req.params;
    
    console.log(`Serving file: ${filename} for job: ${job_id}`);
    
    // Download file from Google Cloud Storage
    const fileBuffer = await firebaseStorageService.downloadFile(job_id, filename);
    
    // Get file metadata for headers
    const fileMetadata = await firebaseStorageService.getFileMetadata(job_id, filename);
    
    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', fileBuffer.length);
    
    if (fileMetadata.contentType) {
      res.setHeader('Content-Type', fileMetadata.contentType);
    }

    // Send the file
    res.send(fileBuffer);

  } catch (error) {
    console.error('Error serving file:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ 
        error: 'File not found' 
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

// Get file info without downloading
router.get('/:job_id/:filename/info', async (req, res) => {
  try {
    const { job_id, filename } = req.params;
    
    console.log(`Getting file info: ${filename} for job: ${job_id}`);
    
    // Get file metadata from Google Cloud Storage
    const fileMetadata = await firebaseStorageService.getFileMetadata(job_id, filename);
    
    res.json({
      filename: filename,
      size: parseInt(fileMetadata.size || '0'),
      mimeType: fileMetadata.contentType,
      createdAt: fileMetadata.timeCreated,
      modifiedAt: fileMetadata.updated,
      downloadUrl: `/api/files/${job_id}/${filename}`,
      path: fileMetadata.name,
    });

  } catch (error) {
    console.error('Error getting file info:', error);
    if (error instanceof Error && error.message.includes('not found')) {
      res.status(404).json({ 
        error: 'File not found' 
      });
    } else {
      res.status(500).json({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
});

export default router;
