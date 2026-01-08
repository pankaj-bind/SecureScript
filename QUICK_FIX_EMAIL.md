# Quick Start: Fix Email OTP Issue

## Problem
You're getting "Failed to send OTP" error because email is not configured.

## Solution (5 Minutes Setup)

### 1. Get Gmail App Password
1. Open: https://myaccount.google.com/apppasswords
2. If you don't see this page, first enable 2-Step Verification at: https://myaccount.google.com/security
3. Create app password:
   - App: Select "Mail"
   - Device: Select "Other" and type "SecureScript"
   - Click "Generate"
4. **COPY** the 16-character password (like: abcd efgh ijkl mnop)

### 2. Create .env File
1. Navigate to: `backend` folder
2. Create a new file named `.env` (yes, just .env with the dot)
3. Add these two lines:
   ```
   EMAIL_HOST_USER=pankajbind30@gmail.com
   EMAIL_HOST_PASSWORD=your-16-char-password-here
   ```
4. Replace with YOUR Gmail address and the app password you copied
5. Save the file

### 3. Restart Server
```bash
# Stop the current server (Ctrl+C)
# Then restart it:
cd backend
python manage.py runserver
```

### 4. Test It!
1. Go to Forgot Password page
2. Enter your email: pankajbind30@gmail.com
3. Click "Send Reset Code"
4. Check your phone/email - OTP should arrive within seconds!

## Important Notes
- Use the **App Password**, NOT your regular Gmail password
- The `.env` file is secret - don't share it
- OTP expires in 5 minutes

## Still Not Working?
Check:
- [ ] Created .env file in the `backend` folder (not root folder)
- [ ] Used app password (16 characters with spaces)
- [ ] Enabled 2-Step Verification on Google Account
- [ ] Restarted the Django server after creating .env
- [ ] Check spam/junk folder for the email

For detailed instructions, see: `backend/EMAIL_SETUP.md`
