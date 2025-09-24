import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jobsRouter from './routes/jobs.js';
import filesRouter from './routes/files.js';
// Job processor removed - no longer needed

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'BikeRC Backend'
  });
});

// API routes
app.use('/api/jobs', jobsRouter);
app.use('/api/files', filesRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'BikeRC Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      jobs: '/api/jobs',
      files: '/api/files'
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 BikeRC Backend server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔧 API endpoints: http://localhost:${PORT}/api/jobs`);
  
  // Job processor removed - no longer needed
});

export default app;
