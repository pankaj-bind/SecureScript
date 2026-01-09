# SecureScript Deployment Guide

This guide covers deployment for both the frontend (Netlify) and backend (PythonAnywhere).

## 📋 Table of Contents
1. [Backend Deployment (PythonAnywhere)](#backend-deployment)
2. [Frontend Deployment (Netlify)](#frontend-deployment)
3. [Connecting Frontend and Backend](#connecting-frontend-and-backend)

---

## 🔧 Backend Deployment

For detailed backend deployment instructions on PythonAnywhere, see **[BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md)**.

### Quick Backend Deployment Steps:

1. Create a PythonAnywhere account
2. Clone repository: `git clone https://github.com/pankaj-bind/SecureScript.git`
3. Create virtual environment and install dependencies
4. Configure `.env` file with production settings
5. Run migrations and collect static files
6. Configure WSGI file on PythonAnywhere
7. Set up static and media file mappings
8. Reload web app

**Your backend will be live at**: `https://yourusername.pythonanywhere.com/api/`

---

## 🚀 Frontend Deployment

### Prerequisites
- GitHub account
- Netlify account (free tier works)
- Backend API deployed and accessible

### Step 1: Prepare Your Repository

1. **Update API URLs in `.env.production`**:
   ```env
   REACT_APP_API_URL=https://your-backend-url.com/api
   REACT_APP_MEDIA_URL=https://your-backend-url.com/media
   ```

2. **Push to GitHub** (already done):
   ```bash
   git add .
   git commit -m "Setup for Netlify deployment"
   git push origin main
   ```

### Step 2: Deploy to Netlify

#### Option A: Using Netlify UI (Recommended)

1. Go to [Netlify](https://app.netlify.com/)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** and authorize Netlify
4. Select your repository: **`pankaj-bind/SecureScript`**
5. Configure build settings:
   - **Base directory**: `frontend`
   - **Build command**: `CI=false npm run build`
   - **Publish directory**: `frontend/build`
   - **Node version**: `18`

6. Add environment variables (if needed):
   - Go to **Site settings** → **Environment variables**
   - Add any production environment variables

7. Click **"Deploy site"**

#### Option B: Using Netlify CLI

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login to Netlify
netlify login

# Navigate to frontend folder
cd frontend

# Deploy
netlify deploy --prod
```

### Step 3: Configure Custom Domain (Optional)

1. In Netlify dashboard, go to **Domain settings**
2. Click **"Add custom domain"**
3. Follow DNS configuration instructions

### Step 4: Enable Continuous Deployment

Netlify automatically enables continuous deployment. Every push to `main` branch will trigger a new deployment.

## 🖥️ Desktop Application (Electron)

The Windows desktop application is available at:
```
frontend/release/win-unpacked/SecureScript.exe
```

### Building Desktop App

```bash
cd frontend

# Build React app
npm run build

# Package for Windows
# Run the build-app.bat script or manually:
# 1. Copy node_modules/electron/dist to release/win-unpacked
# 2. Create resources/app folder
# 3. Copy build, main.js, preload.js, package.json
# 4. Rename electron.exe to SecureScript.exe
# 5. Set icon using rcedit
```

## ⚙️ Configuration Notes

### Router Configuration
The app automatically detects the environment:
- **Electron**: Uses `HashRouter` (required for `file://` protocol)
- **Web**: Uses `BrowserRouter` (better URLs for web)

### API Configuration
- **Development**: Uses `localhost:8000` (from `.env.local` or default)
- **Production Web**: Uses URLs from `.env.production`
- **Electron**: Uses localhost or configured backend URL

### Build Differences
- **Web Build**: Includes only web features, smaller bundle
- **Electron Build**: Includes all Electron APIs (file system, native dialogs, etc.)

## 🔧 Troubleshooting

### Build Fails on Netlify
- Check Node version is set to 18 or higher
- Ensure all dependencies are in `package.json`
- Check build logs for specific errors

### Blank Page After Deployment
- Verify API URLs in environment variables
- Check browser console for CORS errors
- Ensure backend allows requests from Netlify domain

### Routing Issues
- Verify `_redirects` file exists in `public/` folder
- Check `netlify.toml` configuration
- Clear cache and redeploy if needed

## 📊 Connecting Frontend and Backend

### Step 1: Deploy Backend First
Follow the [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md) guide to deploy on PythonAnywhere.

### Step 2: Update Frontend Environment Variables

Once your backend is deployed, update the frontend environment variables on Netlify:

1. Go to **Site settings** → **Environment variables**
2. Add:
   ```env
   REACT_APP_API_URL=https://yourusername.pythonanywhere.com/api
   REACT_APP_MEDIA_URL=https://yourusername.pythonanywhere.com/media
   ```
3. Click **Save** and **Redeploy**

### Step 3: Update Backend CORS Settings

Update your backend `.env` file on PythonAnywhere:

```env
CORS_ALLOWED_ORIGINS=https://your-app.netlify.app,http://localhost:3000
ALLOWED_HOSTS=yourusername.pythonanywhere.com,localhost,127.0.0.1
```

Then reload your PythonAnywhere web app.

### Testing the Connection

1. Open your Netlify site
2. Try logging in or registering
3. Check browser console for any CORS errors
4. Verify API calls are going to the correct backend URL

---

## 📝 Additional Resources

- **Frontend Deployment**: See sections above
- **Backend Deployment**: [BACKEND_DEPLOYMENT.md](./BACKEND_DEPLOYMENT.md)
- **Netlify Documentation**: https://docs.netlify.com/
- **PythonAnywhere Documentation**: https://help.pythonanywhere.com/

## 🎉 Your App is Live!

- **Frontend (Web)**: `https://your-app.netlify.app`
- **Frontend (Desktop)**: `frontend/release/win-unpacked/SecureScript.exe`
- **Backend API**: `https://yourusername.pythonanywhere.com/api/`
- **Admin Panel**: `https://yourusername.pythonanywhere.com/admin/`
- **Railway**: Easy Python/Django hosting
- **Heroku**: Classic platform-as-a-service
- **DigitalOcean**: VPS with more control
- **AWS**: Enterprise-grade hosting

Update frontend `.env.production` with your backend URL after deployment.

## 🎯 Post-Deployment Checklist

- [ ] Backend API is accessible
- [ ] CORS is configured to allow Netlify domain
- [ ] Environment variables are set correctly
- [ ] Custom domain is configured (if using)
- [ ] SSL certificate is active (Netlify provides free SSL)
- [ ] Test all features in production
- [ ] Monitor Netlify deploy logs for issues

## 📝 Netlify Configuration Files

- **`netlify.toml`**: Build and redirect configuration
- **`frontend/public/_redirects`**: SPA routing fallback
- **`.env.production`**: Production environment variables

---

**Deployed by**: SecureScript Team  
**Last Updated**: January 9, 2026
