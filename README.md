# BikeRC Backend

A simple Express.js backend for storing and managing job IDs from the BikeRC application.

## Features

- Store job IDs from external APIs
- Firebase Firestore integration for data persistence
- RESTful API endpoints for job management
- Firebase Functions deployment ready
- No authentication required (as requested)

## API Endpoints

### Jobs

- `POST /api/jobs` - Create a new job
- `GET /api/jobs` - Get all jobs (with optional limit)
- `GET /api/jobs/:id` - Get job by internal ID
- `GET /api/jobs/job-id/:job_id` - Get job by external job_id
- `PUT /api/jobs/:id` - Update job status/metadata
- `DELETE /api/jobs/:id` - Delete job
- `GET /api/jobs/status/:status` - Get jobs by status

### Job Details & Files

- `POST /api/jobs/:job_id/fetch-details` - Fetch job details from external API and download all files
- `GET /api/jobs/:job_id/external-details` - Get job details from external API (without downloading files)
- `GET /api/jobs/:job_id/complete` - Get job with all associated data (details + files)
- `GET /api/jobs/:job_id/files` - Get list of downloaded files for a job
- `DELETE /api/jobs/:job_id/files` - Delete all downloaded files for a job

### File Serving

- `GET /api/files/:job_id/:filename` - Download a specific file
- `GET /api/files/:job_id/:filename/info` - Get file information without downloading

### Health Check

- `GET /health` - Server health status

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Firebase Configuration

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Firestore Database
3. Create a service account and download the JSON key
4. Copy `env.example` to `.env` and fill in your Firebase credentials:

```bash
cp env.example .env
```

### 3. Environment Variables

Update `.env` with your Firebase project details:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=your-private-key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=your-client-email
FIREBASE_CLIENT_ID=your-client-id
FIREBASE_AUTH_URI=https://accounts.google.com/o/oauth2/auth
FIREBASE_TOKEN_URI=https://oauth2.googleapis.com/token
PORT=3001
NODE_ENV=development
```

## Development

### Local Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

### Build

```bash
npm run build
```

## Firebase Deployment

### 1. Install Firebase CLI

```bash
npm install -g firebase-tools
```

### 2. Login to Firebase

```bash
firebase login
```

### 3. Initialize Firebase (if not already done)

```bash
firebase init
```

### 4. Deploy

```bash
npm run deploy
```

## Usage Examples

### Create a Job

```bash
curl -X POST http://localhost:3001/api/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_id": "job_12345",
    "metadata": {
      "client_name": "John Doe",
      "bike_model": "Trek 2024",
      "type": "measurement"
    }
  }'
```

### Get All Jobs

```bash
curl http://localhost:3001/api/jobs
```

### Get Job by job_id

```bash
curl http://localhost:3001/api/jobs/job-id/job_12345
```

### Update Job Status

```bash
curl -X PUT http://localhost:3001/api/jobs/{internal_id} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed"
  }'
```

### Fetch Job Details and Download Files

```bash
curl -X POST http://localhost:3001/api/jobs/{job_id}/fetch-details
```

### Get Job with All Data

```bash
curl http://localhost:3001/api/jobs/{job_id}/complete
```

### Get Downloaded Files

```bash
curl http://localhost:3001/api/jobs/{job_id}/files
```

### Download a File

```bash
curl http://localhost:3001/api/files/{job_id}/{filename} -o downloaded_file.ext
```

## Data Structure

### Job Object

```typescript
{
  id: string;                    // Internal database ID
  job_id: string;               // External job ID from your API
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  updated_at: Date;
  metadata?: {
    client_name?: string;
    bike_model?: string;
    type?: 'measurement' | 'analysis';
    filename?: string;
    estimated_wait_time?: string;
    queue_position?: number;
  };
}
```

## Firebase Functions

The backend is configured to deploy as Firebase Functions. After deployment, your API will be available at:

```
https://us-central1-{your-project-id}.cloudfunctions.net/api
```

## Security

- Firestore rules are set to allow read/write access (as requested, no authentication)
- For production, consider implementing proper authentication and more restrictive Firestore rules
