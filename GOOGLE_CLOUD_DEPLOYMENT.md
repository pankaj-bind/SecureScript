# Backend Deployment Guide - Google Cloud

Complete guide for deploying SecureScript Django backend on Google Cloud Platform (GCP).

## Prerequisites

- Google Account (Gmail)
- Credit/Debit card for GCP (Free tier available with $300 credit for 90 days)
- GitHub repository access

## Part 1: Google Cloud Setup

### Step 1: Create Google Cloud Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Sign in with your Google account
3. Click **"Try for Free"** or **"Get Started"**
4. Fill in your country, accept terms, and click **Continue**
5. Enter billing information (You get $300 free credits, won't be charged during trial)
6. Click **"Start my free trial"**

### Step 2: Create a New Project

1. In Google Cloud Console, click the **project dropdown** at the top
2. Click **"New Project"**
3. Enter project name: `securescript`
4. Click **"Create"**
5. Wait for project creation (takes ~30 seconds)
6. Select your new project from the dropdown

### Step 3: Enable Required APIs

1. Go to **Navigation Menu (☰)** → **APIs & Services** → **Library**
2. Search and enable these APIs:
   - **Cloud Run API** (Click **Enable**)
   - **Cloud Build API** (Click **Enable**)
   - **Artifact Registry API** (Click **Enable**)
   - **Secret Manager API** (Click **Enable**)

---

## Part 2: Prepare Your Django Application

### Step 1: Update Django Settings

Create a new file `backend/core/production_settings.py`:

```python
from .settings import *
import os

# Production settings
DEBUG = False

# Google Cloud Run provides PORT environment variable
PORT = os.environ.get('PORT', '8080')

# Allowed hosts - will be set via environment variable
ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '').split(',')

# Database - use Cloud SQL or keep SQLite
# For SQLite in production (not recommended for scale):
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': '/data/db.sqlite3',  # Persistent storage path
    }
}

# Static files - will be served by Cloud Run
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
STATIC_URL = '/static/'

# Media files
MEDIA_ROOT = '/data/media'
MEDIA_URL = '/media/'

# Security settings
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'

# CORS settings from environment
CORS_ALLOWED_ORIGINS = os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',')
CORS_ALLOW_CREDENTIALS = True
```

### Step 2: Create Dockerfile

Create `backend/Dockerfile`:

```dockerfile
# Use Python 3.10 slim image
FROM python:3.10-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy project
COPY . .

# Create directories for persistent storage
RUN mkdir -p /data/media /data/staticfiles

# Collect static files
RUN python manage.py collectstatic --noinput

# Create a non-root user
RUN useradd -m -u 1000 appuser && \
    chown -R appuser:appuser /app /data
USER appuser

# Expose port
EXPOSE 8080

# Run gunicorn
CMD exec gunicorn --bind 0.0.0.0:$PORT --workers 2 --threads 4 --timeout 0 core.wsgi:application
```

### Step 3: Create .dockerignore

Create `backend/.dockerignore`:

```
*.pyc
*.pyo
*.pyd
__pycache__/
.env
.env.local
.venv
venv/
env/
db.sqlite3
*.log
.git/
.gitignore
README.md
.DS_Store
```

### Step 4: Update requirements.txt

Add these to `backend/requirements.txt`:

```
gunicorn==21.2.0
whitenoise==6.6.0
```

---

## Part 3: Deploy to Google Cloud Run

### Step 1: Install Google Cloud SDK

**For Windows:**

1. Download [Google Cloud SDK Installer](https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe)
2. Run the installer
3. Follow the installation wizard
4. Check "Start Cloud SDK Shell" and click Finish

**Verify installation:**
```bash
gcloud --version
```

### Step 2: Initialize gcloud

Open **Command Prompt** or **PowerShell** and run:

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project securescript

# Set default region (choose closest to you)
gcloud config set run/region us-central1
```

**Available regions:**
- `us-central1` (Iowa, USA)
- `us-east1` (South Carolina, USA)
- `europe-west1` (Belgium, Europe)
- `asia-south1` (Mumbai, India)

### Step 3: Create Cloud Storage Bucket (for media files)

```bash
# Create bucket for media files
gsutil mb -l us-central1 gs://securescript-media

# Make bucket publicly readable (for serving media)
gsutil iam ch allUsers:objectViewer gs://securescript-media
```

### Step 4: Set Up Secrets

```bash
# Create secrets for sensitive data
echo -n "your-super-secret-django-key-here" | gcloud secrets create DJANGO_SECRET_KEY --data-file=-

echo -n "your-email@gmail.com" | gcloud secrets create EMAIL_HOST_USER --data-file=-

echo -n "your-app-password" | gcloud secrets create EMAIL_HOST_PASSWORD --data-file=-
```

### Step 5: Build and Deploy

Navigate to backend directory:

```bash
cd C:\Users\Pankaj Kumar Bind\Documents\SecureScript\backend
```

Build and deploy:

```bash
# Build container image
gcloud builds submit --tag gcr.io/securescript/backend

# Deploy to Cloud Run
gcloud run deploy securescript-backend \
  --image gcr.io/securescript/backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --set-env-vars "ALLOWED_HOSTS=.run.app" \
  --set-env-vars "CORS_ALLOWED_ORIGINS=https://securescript.netlify.app,http://localhost:3000,app://." \
  --set-secrets "SECRET_KEY=DJANGO_SECRET_KEY:latest" \
  --set-secrets "EMAIL_HOST_USER=EMAIL_HOST_USER:latest" \
  --set-secrets "EMAIL_HOST_PASSWORD=EMAIL_HOST_PASSWORD:latest"
```

**Note:** This will take 3-5 minutes. You'll get a service URL like:
`https://securescript-backend-xxxxx-uc.a.run.app`

### Step 6: Run Migrations

After deployment, run migrations:

```bash
# Get the service URL
gcloud run services describe securescript-backend --platform managed --region us-central1 --format 'value(status.url)'

# Run migrations (one-time setup)
gcloud run jobs create securescript-migrate \
  --image gcr.io/securescript/backend \
  --region us-central1 \
  --set-env-vars "ALLOWED_HOSTS=.run.app" \
  --set-secrets "SECRET_KEY=DJANGO_SECRET_KEY:latest" \
  --command python \
  --args "manage.py,migrate"

gcloud run jobs execute securescript-migrate --region us-central1
```

### Step 7: Create Superuser

```bash
# Create a job to create superuser
gcloud run jobs create securescript-createsuperuser \
  --image gcr.io/securescript/backend \
  --region us-central1 \
  --set-env-vars "ALLOWED_HOSTS=.run.app" \
  --set-secrets "SECRET_KEY=DJANGO_SECRET_KEY:latest" \
  --command python \
  --args "manage.py,createsuperuser,--noinput,--username=admin,--email=admin@securescript.com"

# Note: You'll need to reset password via Django admin or shell
```

---

## Part 4: Upload Database and Media Files

### Upload Media Files

```bash
# Upload your local media files to Cloud Storage
gsutil -m cp -r "C:\Users\Pankaj Kumar Bind\Documents\SecureScript\backend\media\*" gs://securescript-media/

# Verify upload
gsutil ls gs://securescript-media/
```

### Upload Database (if using SQLite)

```bash
# Create a persistent disk for database
gcloud compute disks create securescript-db-disk \
  --size 10GB \
  --zone us-central1-a

# Note: For production, use Cloud SQL (PostgreSQL/MySQL) instead
```

**Better Option: Use Cloud SQL (PostgreSQL)**

```bash
# Create Cloud SQL instance
gcloud sql instances create securescript-db \
  --database-version=POSTGRES_14 \
  --tier=db-f1-micro \
  --region=us-central1

# Create database
gcloud sql databases create securescript --instance=securescript-db

# Set password for postgres user
gcloud sql users set-password postgres \
  --instance=securescript-db \
  --password=YOUR_SECURE_PASSWORD

# Get connection name
gcloud sql instances describe securescript-db --format='value(connectionName)'
```

Then update your Cloud Run deployment to use Cloud SQL:

```bash
gcloud run services update securescript-backend \
  --add-cloudsql-instances YOUR_CONNECTION_NAME \
  --set-env-vars "DB_ENGINE=django.db.backends.postgresql" \
  --set-env-vars "DB_NAME=securescript" \
  --set-env-vars "DB_USER=postgres" \
  --set-env-vars "DB_HOST=/cloudsql/YOUR_CONNECTION_NAME" \
  --set-secrets "DB_PASSWORD=DB_PASSWORD:latest"
```

---

## Part 5: Update Frontend to Use Google Cloud Backend

### Update Frontend Environment Variables

**For local development (.env.local):**
```env
REACT_APP_API_URL=https://securescript-backend-xxxxx-uc.a.run.app/api
REACT_APP_MEDIA_URL=https://storage.googleapis.com/securescript-media
```

**For Netlify (.env.production):**
```env
REACT_APP_API_URL=https://securescript-backend-xxxxx-uc.a.run.app/api
REACT_APP_MEDIA_URL=https://storage.googleapis.com/securescript-media
```

### Rebuild and Deploy Frontend

```bash
cd C:\Users\Pankaj Kumar Bind\Documents\SecureScript\frontend

# Update .env.local with your Cloud Run URL
# Then rebuild
npm run build

# Commit and push to GitHub (Netlify will auto-deploy)
git add .
git commit -m "Update API URL to Google Cloud Run"
git push origin main
```

---

## Part 6: Monitoring and Logging

### View Logs

```bash
# View recent logs
gcloud run services logs read securescript-backend --limit 50

# Stream logs in real-time
gcloud run services logs tail securescript-backend
```

### View in Console

1. Go to [Cloud Run Console](https://console.cloud.google.com/run)
2. Click on **securescript-backend**
3. Click **LOGS** tab to view application logs
4. Click **METRICS** tab to view performance

---

## Part 7: Custom Domain (Optional)

### Set Up Custom Domain

1. Go to Cloud Run Console
2. Click on your service **securescript-backend**
3. Click **MANAGE CUSTOM DOMAINS**
4. Click **ADD MAPPING**
5. Select your domain (or verify a new one)
6. Add DNS records as instructed

---

## Updating Your Deployment

When you make code changes:

```bash
cd C:\Users\Pankaj Kumar Bind\Documents\SecureScript\backend

# Rebuild and deploy
gcloud builds submit --tag gcr.io/securescript/backend
gcloud run deploy securescript-backend --image gcr.io/securescript/backend

# Run migrations if needed
gcloud run jobs execute securescript-migrate --region us-central1
```

---

## Cost Estimation (Free Tier)

**Google Cloud Free Tier includes:**
- Cloud Run: 2 million requests/month
- Cloud Storage: 5 GB storage
- Cloud Build: 120 build-minutes/day
- Cloud SQL: Not included in free tier (~$10/month for smallest instance)

**Estimated Monthly Cost (After Free Credits):**
- Small traffic: $0-5/month (free tier covers most)
- Medium traffic: $10-30/month
- With Cloud SQL: Add $10-15/month

---

## Troubleshooting

### Container fails to start

```bash
# Check logs
gcloud run services logs read securescript-backend --limit 100

# Common issues:
# - Missing environment variables
# - Database connection errors
# - Port binding (must use $PORT)
```

### CORS Errors

```bash
# Update CORS settings
gcloud run services update securescript-backend \
  --set-env-vars "CORS_ALLOWED_ORIGINS=https://securescript.netlify.app,http://localhost:3000,app://."
```

### Database Errors

```bash
# Connect to Cloud SQL and check
gcloud sql connect securescript-db --user=postgres

# Run migrations again
gcloud run jobs execute securescript-migrate --region us-central1
```

---

## Security Best Practices

1. **Use Secret Manager** for all sensitive data (already configured)
2. **Enable Cloud Armor** for DDoS protection (paid feature)
3. **Set up VPC** for private networking
4. **Enable Cloud Audit Logs**
5. **Regular backups** of database and media files

---

## Backup and Restore

### Backup Database

```bash
# Export Cloud SQL database
gcloud sql export sql securescript-db gs://securescript-backups/backup-$(date +%Y%m%d).sql \
  --database=securescript
```

### Backup Media Files

```bash
# Already in Cloud Storage, but you can download
gsutil -m cp -r gs://securescript-media/ ./backup/
```

---

## Support Resources

- [Google Cloud Documentation](https://cloud.google.com/docs)
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Stack Overflow - Google Cloud](https://stackoverflow.com/questions/tagged/google-cloud-platform)
- [Google Cloud Support](https://cloud.google.com/support)

---

## Summary

Your Django backend is now deployed on Google Cloud Run at:
**`https://securescript-backend-xxxxx-uc.a.run.app`**

**Advantages:**
- ✅ Automatic scaling (0 to millions of requests)
- ✅ Pay only for what you use
- ✅ Free tier covers small projects
- ✅ Global CDN included
- ✅ Automatic HTTPS
- ✅ Easy updates with single command

**Next Steps:**
1. Update frontend with Cloud Run URL
2. Test all API endpoints
3. Set up Cloud SQL for production database
4. Configure custom domain
5. Set up monitoring and alerts
