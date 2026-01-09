# SecureScript Deployment Guide

## 🚀 Netlify Deployment

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

## 📊 Backend Deployment

The backend (Django) needs to be deployed separately. Options:
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
