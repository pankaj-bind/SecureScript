# Backend Deployment Guide - PythonAnywhere

This guide will walk you through deploying the SecureScript Django backend on PythonAnywhere.

## Prerequisites

- PythonAnywhere account (Free or Paid)
- GitHub repository access
- Email app password for SMTP (if using Gmail)

## Step-by-Step Deployment

### 1. Create PythonAnywhere Account

1. Go to [PythonAnywhere](https://www.pythonanywhere.com/)
2. Sign up for an account (Free tier works for testing)
3. Log in to your dashboard

### 2. Clone Repository

Open a Bash console on PythonAnywhere and run:

```bash
cd ~
git clone https://github.com/pankaj-bind/SecureScript.git
cd SecureScript/backend
```

### 3. Create Virtual Environment

```bash
mkvirtualenv securescript-env --python=python3.10
workon securescript-env
```

### 4. Install Dependencies

```bash
cd ~/SecureScript/backend
pip install -r requirements.txt
```

### 5. Configure Environment Variables

Create a `.env` file in the backend directory:

```bash
nano .env
```

Add the following (replace with your actual values):

```env
# Django Settings
SECRET_KEY=your-super-secret-key-change-this
DEBUG=False

# Email Configuration
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password
DEFAULT_FROM_EMAIL=your-email@gmail.com

# Allowed Hosts (add your PythonAnywhere domain)
ALLOWED_HOSTS=yourusername.pythonanywhere.com

# CORS (add your Netlify frontend URL)
CORS_ALLOWED_ORIGINS=https://your-app.netlify.app
```

**Generate a secure SECRET_KEY:**
```bash
python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
```

### 6. Update Django Settings

Update `backend/core/settings.py` to use environment variables:

```python
# Update ALLOWED_HOSTS
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# Update CORS_ALLOWED_ORIGINS
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
```

### 7. Run Migrations

```bash
cd ~/SecureScript/backend
python manage.py migrate
python manage.py collectstatic --noinput
```

### 8. Create Superuser

```bash
python manage.py createsuperuser
```

### 9. Configure Web App on PythonAnywhere

1. Go to **Web** tab on PythonAnywhere dashboard
2. Click **Add a new web app**
3. Choose **Manual configuration**
4. Select **Python 3.10** (or your preferred version)
5. Click **Next**

### 10. Configure WSGI File

1. On the Web tab, click on the **WSGI configuration file** link
2. Replace the contents with:

```python
import os
import sys

# Add your project directory to the sys.path
project_home = '/home/yourusername/SecureScript/backend'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set Django settings module
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'

# Load environment variables
from dotenv import load_dotenv
load_dotenv(os.path.join(project_home, '.env'))

# Get WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
```

**Important:** Replace `yourusername` with your actual PythonAnywhere username.

### 11. Configure Virtual Environment

1. On the Web tab, scroll to **Virtualenv** section
2. Enter: `/home/pankajbind/.virtualenvs/securescript-env`
3. Replace `yourusername` with your actual username

### 12. Configure Static Files

1. On the Web tab, scroll to **Static files** section
2. Add a new mapping:
   - URL: `/static/`
   - Directory: `/home/pankajbind/SecureScript/backend/staticfiles`

3. Add another mapping for media files:
   - URL: `/media/`
   - Directory: `/home/pankajbind/SecureScript/backend/media`
**Important:** Replace `yourusername` with your actual PythonAnywhere username.

### 13. Reload Web App

1. Scroll to the top of the Web tab
2. Click the green **Reload** button
3. Wait for the reload to complete

### 14. Test Your Deployment

Visit `https://yourusername.pythonanywhere.com/api/` to verify the API is working.

Test endpoints:
- `/api/auth/login/` - Login endpoint
- `/api/auth/register/` - Registration endpoint
- `/admin/` - Django admin panel

## Database Options

### SQLite (Default - Good for Testing)
- Already configured
- Database file stored at `backend/db.sqlite3`
- Limited to 512MB on free tier

### MySQL (Recommended for Production)

1. **Create MySQL database:**
   - Go to **Databases** tab on PythonAnywhere
   - Initialize MySQL
   - Create a new database

2. **Install MySQL client:**
   ```bash
   pip install mysqlclient
   ```

3. **Update settings.py:**
   ```python
   DATABASES = {
       'default': {
           'ENGINE': 'django.db.backends.mysql',
           'NAME': 'yourusername$dbname',
           'USER': 'yourusername',
           'PASSWORD': 'your-mysql-password',
           'HOST': 'yourusername.mysql.pythonanywhere-services.com',
           'OPTIONS': {
               'init_command': "SET sql_mode='STRICT_TRANS_TABLES'",
           },
       }
   }
   ```

4. **Run migrations again:**
   ```bash
   python manage.py migrate
   ```

## Security Considerations

### 1. Update Django Settings

Ensure these settings in `settings.py`:

```python
# Security settings for production
DEBUG = False
ALLOWED_HOSTS = os.getenv('ALLOWED_HOSTS', '').split(',')

# HTTPS settings (PythonAnywhere provides HTTPS)
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# Additional security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
```

### 2. Environment Variables

- Never commit `.env` file to Git
- Use strong SECRET_KEY
- Use app-specific passwords for email

### 3. CORS Configuration

Update CORS settings to allow only your frontend domain:

```python
CORS_ALLOWED_ORIGINS = [
    "https://your-app.netlify.app",
]

CORS_ALLOW_CREDENTIALS = True
```

## Updating Your Deployment

When you make changes to your code:

```bash
# SSH into PythonAnywhere console
cd ~/SecureScript/backend

# Pull latest changes
git pull origin main

# Activate virtual environment
workon securescript-env

# Install new dependencies (if any)
pip install -r requirements.txt

# Run migrations (if any)
python manage.py migrate

# Collect static files
python manage.py collectstatic --noinput

# Reload web app (or use dashboard)
touch /var/www/yourusername_pythonanywhere_com_wsgi.py
```

Or simply click the **Reload** button on the Web tab.

## Connecting Frontend to Backend

### Update Frontend Environment Variables

In your Netlify deployment, set these environment variables:

```env
REACT_APP_API_URL=https://yourusername.pythonanywhere.com/api
REACT_APP_MEDIA_URL=https://yourusername.pythonanywhere.com/media
```

### Update Backend CORS

In `backend/core/settings.py`, add your Netlify domain:

```python
CORS_ALLOWED_ORIGINS = [
    "https://your-app.netlify.app",
    "http://localhost:3000",  # for local development
]
```

Reload your PythonAnywhere web app after making changes.

## Troubleshooting

### 502 Bad Gateway Error

1. Check error log: Web tab → Error log link
2. Verify WSGI configuration paths are correct
3. Ensure virtual environment is activated
4. Check if all dependencies are installed

### Static Files Not Loading

1. Run `python manage.py collectstatic`
2. Verify static files mapping on Web tab
3. Check STATIC_ROOT and STATIC_URL in settings

### Database Errors

1. Ensure migrations are run: `python manage.py migrate`
2. Check database file permissions
3. Verify database path in settings

### CORS Errors

1. Add frontend domain to CORS_ALLOWED_ORIGINS
2. Reload web app after changes
3. Check browser console for specific CORS errors

### Email Not Sending

1. Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
2. Use app-specific password for Gmail
3. Check email service provider settings

## Free Tier Limitations

- **CPU seconds:** 100 seconds/day
- **Disk space:** 512MB
- **Web app:** One web app
- **MySQL:** One database, 512MB
- **Custom domains:** Not available

Consider upgrading to a paid plan for production use.

## Monitoring

1. **Access logs:** Web tab → Access log
2. **Error logs:** Web tab → Error log
3. **Server logs:** Web tab → Server log

Check logs regularly for errors and issues.

## Backup

### Backup Database

```bash
# For SQLite
cp ~/SecureScript/backend/db.sqlite3 ~/backups/db-$(date +%Y%m%d).sqlite3

# For MySQL
mysqldump -u yourusername -h yourusername.mysql.pythonanywhere-services.com 'yourusername$dbname' > backup.sql
```

### Backup Media Files

```bash
tar -czf media-backup-$(date +%Y%m%d).tar.gz ~/SecureScript/backend/media/
```

## Support

- PythonAnywhere Forums: https://www.pythonanywhere.com/forums/
- PythonAnywhere Help: https://help.pythonanywhere.com/
- Django Documentation: https://docs.djangoproject.com/

## Next Steps

1. Set up automated backups
2. Configure email notifications for errors
3. Set up monitoring/alerting
4. Implement rate limiting
5. Add API documentation (Swagger/OpenAPI)
6. Set up CI/CD pipeline

---

**Your backend should now be live at:** `https://yourusername.pythonanywhere.com/api/`

Remember to update your frontend environment variables with this URL!
