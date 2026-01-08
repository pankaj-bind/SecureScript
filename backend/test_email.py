"""
Test email configuration
Run this script to test if email is working: python test_email.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.mail import send_mail
from django.conf import settings

print("=" * 50)
print("EMAIL CONFIGURATION TEST")
print("=" * 50)
print(f"EMAIL_BACKEND: {settings.EMAIL_BACKEND}")
print(f"EMAIL_HOST: {settings.EMAIL_HOST}")
print(f"EMAIL_PORT: {settings.EMAIL_PORT}")
print(f"EMAIL_USE_TLS: {settings.EMAIL_USE_TLS}")
print(f"EMAIL_HOST_USER: {settings.EMAIL_HOST_USER}")
print(f"EMAIL_HOST_PASSWORD: {'*' * len(settings.EMAIL_HOST_PASSWORD) if settings.EMAIL_HOST_PASSWORD else 'NOT SET'}")
print(f"DEFAULT_FROM_EMAIL: {settings.DEFAULT_FROM_EMAIL}")
print("=" * 50)

if not settings.EMAIL_HOST_USER:
    print("\n❌ ERROR: EMAIL_HOST_USER is not set!")
    print("Please create a .env file in the backend folder with:")
    print("EMAIL_HOST_USER=your-email@gmail.com")
    print("EMAIL_HOST_PASSWORD=your-app-password")
    exit(1)

if not settings.EMAIL_HOST_PASSWORD:
    print("\n❌ ERROR: EMAIL_HOST_PASSWORD is not set!")
    print("Please add EMAIL_HOST_PASSWORD to your .env file")
    exit(1)

print("\nSending test email...")
try:
    send_mail(
        subject='Test Email from SecureScript',
        message='This is a test email. If you received this, your email configuration is working!',
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[settings.EMAIL_HOST_USER],
        fail_silently=False,
    )
    print("✅ SUCCESS! Email sent successfully!")
    print(f"Check your inbox at: {settings.EMAIL_HOST_USER}")
except Exception as e:
    print(f"\n❌ ERROR: Failed to send email")
    print(f"Error type: {type(e).__name__}")
    print(f"Error message: {str(e)}")
    print("\nCommon issues:")
    print("1. Make sure you're using a Gmail App Password (not your regular password)")
    print("2. Enable 2-Step Verification on your Google Account")
    print("3. Generate app password at: https://myaccount.google.com/apppasswords")
    print("4. Make sure .env file exists in the backend folder")
    print("5. Restart the Django server after creating .env file")
