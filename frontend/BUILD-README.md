# SecureScript - Windows Executable

## 📦 Package Contents

The Windows executable has been successfully built! You can find it in:
`dist/SecureScript-win32-x64/`

## 🚀 Running the Application

### Option 1: Run Directly
1. Navigate to `dist/SecureScript-win32-x64/`
2. Double-click `SecureScript.exe`

### Option 2: Create Desktop Shortcut
1. Go to `dist/SecureScript-win32-x64/`
2. Right-click on `SecureScript.exe`
3. Select "Send to" > "Desktop (create shortcut)"

## 📋 System Requirements

- **Operating System**: Windows 10/11 (64-bit)
- **RAM**: Minimum 4GB recommended
- **Disk Space**: ~200MB for the application

## 🛠️ Development

### Build from Source

```bash
# Install dependencies
npm install

# Generate icons
npm run generate-icons

# Build React app
npm run build

# Package for Windows
npx electron-packager . SecureScript --platform=win32 --arch=x64 --out=dist --overwrite --asar
```

### Development Mode

```bash
npm run dev
```

## 🎨 Application Icon

The application uses a security shield icon with a checkmark, representing:
- 🛡️ **Security**: Protection and compliance
- ✓ **Verification**: Policy compliance checking
- 🔵 **Trust**: Professional and reliable

## 📦 Distribution

To distribute the application:

1. **Portable Version**: 
   - Zip the entire `SecureScript-win32-x64` folder
   - Users can extract and run directly

2. **Installer** (requires electron-builder):
   ```bash
   npm run package:win
   ```
   This will create an NSIS installer in `dist/`

## 🔧 Troubleshooting

### Application won't start
- Ensure you're running Windows 10/11 (64-bit)
- Check if Windows Defender or antivirus is blocking the app
- Run as Administrator if accessing system policies

### Missing DLL errors
- Ensure the entire `SecureScript-win32-x64` folder is intact
- Don't move `SecureScript.exe` out of its folder

## 📄 License

Copyright © 2026 SecureScript Team
