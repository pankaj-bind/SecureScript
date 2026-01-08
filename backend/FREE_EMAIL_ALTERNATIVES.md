# Free Email Alternatives for Development

## Option 1: Mailtrap (EASIEST - Recommended) ⭐
**Perfect for testing - emails don't actually send, but you can view them in inbox**

1. Sign up FREE: https://mailtrap.io/register/signup
2. Go to: Email Testing → Inboxes → My Inbox → SMTP Settings
3. Copy the credentials (they look like this):
   ```
   Host: sandbox.smtp.mailtrap.io
   Port: 2525
   Username: 1a2b3c4d5e6f7g
   Password: 9h8i7j6k5l4m3n
   ```
4. Update your `backend/.env`:
   ```
   EMAIL_HOST_USER=your_mailtrap_username
   EMAIL_HOST_PASSWORD=your_mailtrap_password
   ```
5. Update `backend/core/settings.py`:
   ```python
   EMAIL_HOST = 'sandbox.smtp.mailtrap.io'
   EMAIL_PORT = 2525
   EMAIL_USE_TLS = True
   ```
6. Check emails in Mailtrap web interface!

**Pros:** 
- No app passwords needed
- Works immediately
- See all test emails in web interface
- 500 emails/month free

---

## Option 2: Brevo (SendinBlue) - REAL EMAILS
**For actual email sending (300 emails/day free)**

1. Sign up: https://app.brevo.com/account/register
2. Go to: Settings → SMTP & API → SMTP
3. Copy credentials
4. Update `.env`:
   ```
   EMAIL_HOST_USER=your-brevo-email@gmail.com
   EMAIL_HOST_PASSWORD=your_smtp_key
   ```
5. Update `settings.py`:
   ```python
   EMAIL_HOST = 'smtp-relay.brevo.com'
   EMAIL_PORT = 587
   EMAIL_USE_TLS = True
   ```

**Pros:** 
- Actually sends real emails
- 300 emails/day free
- No app password hassle

---

## Option 3: Keep Gmail BUT Use Console Backend (For Development Only)
**Emails print in terminal instead of sending**

Just update `backend/core/settings.py`:
```python
# For development - prints emails to console
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
# Comment out SMTP settings
# EMAIL_HOST = 'smtp.gmail.com'
# EMAIL_PORT = 587
# ...
```

**Pros:** 
- No setup needed
- See OTP codes in terminal
- Perfect for development

---

## Which Should You Use?

**For Development/Testing:** Use **Option 3** (Console) or **Option 1** (Mailtrap)  
**For Production:** Use **Option 2** (Brevo) or fix Gmail

---

## How to Fix Gmail (If You Still Want It)

Your password `edos ycjl ulcx iefe` is INVALID. Here's how to get a correct one:

1. Go to: https://myaccount.google.com/apppasswords
2. You MUST see "App passwords" option
   - If not visible: Enable 2-Step Verification first
3. Create new app password:
   - App: Mail
   - Device: Other (type "SecureScript")
4. Copy the EXACT 16-character password (with or without spaces)
5. Update `.env` with the COMPLETE password

The format is: `abcd efgh ijkl mnop` (exactly 16 characters)
