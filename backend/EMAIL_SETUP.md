# Email Setup Instructions

## For Gmail Users (Recommended for Testing)

### Step 1: Enable 2-Step Verification
1. Go to your Google Account: https://myaccount.google.com/
2. Click on "Security" in the left sidebar
3. Under "How you sign in to Google", enable "2-Step Verification"

### Step 2: Generate App Password
1. Go to App Passwords: https://myaccount.google.com/apppasswords
   - Or: Google Account → Security → 2-Step Verification → App passwords
2. Select "Mail" for the app
3. Select "Other" for the device and name it "SecureScript"
4. Click "Generate"
5. Copy the 16-character password (format: xxxx xxxx xxxx xxxx)

### Step 3: Configure Environment Variables
1. In the `backend` folder, create a file named `.env`
2. Add your email credentials:
   ```
   EMAIL_HOST_USER=your-email@gmail.com
   EMAIL_HOST_PASSWORD=xxxx xxxx xxxx xxxx
   ```
   **Important:** Use the 16-character app password, NOT your regular Gmail password!

### Step 4: Install Dependencies
```bash
cd backend
pip install python-dotenv
# Or install all requirements:
pip install -r requirements.txt
```

### Step 5: Restart Django Server
```bash
python manage.py runserver
```

## Alternative Email Providers

### For Other Gmail-like Services
- **Outlook/Hotmail:**
  - EMAIL_HOST = 'smtp-mail.outlook.com'
  - EMAIL_PORT = 587
  - Use your Outlook email and password

- **Yahoo Mail:**
  - EMAIL_HOST = 'smtp.mail.yahoo.com'
  - EMAIL_PORT = 587
  - Generate app password in Yahoo Account Security

- **Custom SMTP:**
  - Update EMAIL_HOST and EMAIL_PORT in `core/settings.py`
  - Add credentials to `.env` file

## Testing

1. Try the "Forgot Password" feature
2. Check your email inbox (and spam folder)
3. The OTP code should arrive within seconds
4. OTP is valid for 5 minutes

## Troubleshooting

**"Failed to send OTP" error:**
- Check that `.env` file exists in the `backend` folder
- Verify EMAIL_HOST_USER and EMAIL_HOST_PASSWORD are correct
- Ensure you're using an app password, not your regular password
- Check if 2-Step Verification is enabled on your Google Account

**Email not arriving:**
- Check spam/junk folder
- Verify the email address is correct
- Try sending a test email using the same credentials

**"Less secure app access" warning:**
- This is an old method - USE APP PASSWORDS instead
- App passwords are more secure and recommended by Google

## Security Notes

- Never commit the `.env` file to Git (it's already in .gitignore)
- Keep your app password secure
- For production, use a dedicated email service like SendGrid, AWS SES, or Mailgun
