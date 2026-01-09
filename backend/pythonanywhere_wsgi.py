"""
WSGI configuration for PythonAnywhere deployment.

This file should be used to configure the WSGI application on PythonAnywhere.
Copy the contents of this file to your WSGI configuration file on PythonAnywhere.

Steps to configure on PythonAnywhere:
1. Go to Web tab on PythonAnywhere dashboard
2. Click on "WSGI configuration file" link
3. Replace the contents with this file
4. Update the paths to match your PythonAnywhere directory structure
"""

import os
import sys

# Add your project directory to the sys.path
# Replace 'yourusername' with your actual PythonAnywhere username
project_home = '/home/pankajbind/SecureScript/backend'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set environment variable to tell Django where settings are
os.environ['DJANGO_SETTINGS_MODULE'] = 'core.settings'

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(os.path.join(project_home, '.env'))

# Activate your virtual environment
# Replace 'yourusername' with your actual PythonAnywhere username
# virtualenv_path = '/home/yourusername/.virtualenvs/securescript-env/bin/activate_this.py'
# exec(open(virtualenv_path).read(), {'__file__': virtualenv_path})

# Import Django WSGI application
from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
