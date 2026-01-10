import React from 'react';
import { useNavigate } from 'react-router-dom';

const DownloadPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Detect if running in Electron
  const isElectron = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    return userAgent.indexOf(' electron/') > -1;
  };
  
  // Replace this with your actual download link
  const downloadLink = "https://yourdomain.com/downloads/SecureScript-Setup.exe";
  
  // If running in Electron, show message that download is not needed
  if (isElectron()) {
    return (
      <div className="min-h-screen bg-win-bg-solid py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-win-bg-layer border border-win-border-default rounded-win-lg shadow-win-card p-12 backdrop-blur-win">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-win-accent/10 p-6">
                <svg 
                  className="h-16 w-16 text-win-accent" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl font-bold text-win-text-primary mb-4">
              You're Already Using SecureScript!
            </h1>
            <p className="text-lg text-win-text-secondary mb-8">
              The download page is only available on the web version. You're currently using the desktop application, so no download is needed.
            </p>
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-win text-white bg-win-accent hover:bg-win-accent-hover transition-colors duration-150 shadow-sm"
            >
              <svg 
                className="h-5 w-5 mr-2" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M10 19l-7-7m0 0l7-7m-7 7h18" 
                />
              </svg>
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-win-bg-solid py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="rounded-full bg-win-accent/10 p-6">
              <svg 
                className="h-16 w-16 text-win-accent" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={1.5}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" 
                />
              </svg>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-win-text-primary mb-4">
            Download SecureScript
          </h1>
          <p className="text-lg text-win-text-secondary max-w-2xl mx-auto">
            Get the desktop application for Windows to access all features offline and manage your security scripts efficiently.
          </p>
        </div>

        {/* Download Card */}
        <div className="bg-win-bg-layer border border-win-border-default rounded-win-lg shadow-win-card overflow-hidden backdrop-blur-win">
          <div className="p-8">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0">
                <svg 
                  className="h-12 w-12 text-win-accent" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={1.5} 
                    d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-win-text-primary mb-2">
                  Windows Application
                </h2>
                <p className="text-win-text-secondary mb-6">
                  SecureScript Desktop for Windows - Full-featured desktop application with offline support
                </p>
                
                {/* System Requirements */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-win-text-primary mb-3">System Requirements:</h3>
                  <ul className="space-y-2 text-sm text-win-text-secondary">
                    <li className="flex items-center">
                      <svg className="h-4 w-4 mr-2 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Windows Pro Version (64-bit)
                    </li>
                    <li className="flex items-center">
                      <svg className="h-4 w-4 mr-2 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      LGPO (Local Group Policy Object) must be available
                    </li>
                    <li className="flex items-center">
                      <svg className="h-4 w-4 mr-2 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      4 GB RAM (8 GB recommended)
                    </li>
                    <li className="flex items-center">
                      <svg className="h-4 w-4 mr-2 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      500 MB free disk space
                    </li>
                  </ul>
                </div>

                {/* Download Button */}
                <a
                  href={downloadLink}
                  className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-win text-white bg-win-accent hover:bg-win-accent-hover transition-colors duration-150 shadow-sm"
                  download
                >
                  <svg 
                    className="h-5 w-5 mr-2" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" 
                    />
                  </svg>
                  Download for Windows
                </a>
                
                <p className="mt-4 text-xs text-win-text-tertiary">
                  Latest version • Installer size: ~150 MB
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-win-bg-layer border border-win-border-default rounded-win-lg p-6 backdrop-blur-win">
            <div className="flex items-center justify-center h-12 w-12 rounded-win bg-win-accent/10 mb-4">
              <svg className="h-6 w-6 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-win-text-primary mb-2">Fast & Efficient</h3>
            <p className="text-sm text-win-text-secondary">
              Optimized for performance with quick startup and minimal resource usage
            </p>
          </div>

          <div className="bg-win-bg-layer border border-win-border-default rounded-win-lg p-6 backdrop-blur-win">
            <div className="flex items-center justify-center h-12 w-12 rounded-win bg-win-accent/10 mb-4">
              <svg className="h-6 w-6 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-win-text-primary mb-2">Secure</h3>
            <p className="text-sm text-win-text-secondary">
              Built with security in mind, all data is encrypted and stored locally
            </p>
          </div>

          <div className="bg-win-bg-layer border border-win-border-default rounded-win-lg p-6 backdrop-blur-win">
            <div className="flex items-center justify-center h-12 w-12 rounded-win bg-win-accent/10 mb-4">
              <svg className="h-6 w-6 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-win-text-primary mb-2">Auto Updates</h3>
            <p className="text-sm text-win-text-secondary">
              Stay up-to-date with automatic updates and new features
            </p>
          </div>
        </div>

        {/* Installation Instructions */}
        <div className="mt-12 bg-win-bg-layer border border-win-border-default rounded-win-lg p-8 backdrop-blur-win">
          <h2 className="text-2xl font-semibold text-win-text-primary mb-6">Installation Instructions</h2>
          <ol className="space-y-4 text-win-text-secondary">
            <li className="flex items-start">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-win-accent text-white font-semibold mr-4 flex-shrink-0">1</span>
              <div>
                <p className="font-medium text-win-text-primary mb-1">Download the installer</p>
                <p className="text-sm">Click the download button above to get the SecureScript-Setup.exe file</p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-win-accent text-white font-semibold mr-4 flex-shrink-0">2</span>
              <div>
                <p className="font-medium text-win-text-primary mb-1">Run the installer</p>
                <p className="text-sm">Double-click the downloaded file and follow the installation wizard</p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-win-accent text-white font-semibold mr-4 flex-shrink-0">3</span>
              <div>
                <p className="font-medium text-win-text-primary mb-1">Launch SecureScript</p>
                <p className="text-sm">Find SecureScript in your Start Menu or desktop and launch the application</p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex items-center justify-center h-8 w-8 rounded-full bg-win-accent text-white font-semibold mr-4 flex-shrink-0">4</span>
              <div>
                <p className="font-medium text-win-text-primary mb-1">Sign in</p>
                <p className="text-sm">Use your existing account credentials or create a new account to get started</p>
              </div>
            </li>
          </ol>
        </div>

        {/* Help Section */}
        <div className="mt-8 text-center">
          <p className="text-sm text-win-text-secondary">
            Need help? Visit our{' '}
            <a href="#" className="text-win-accent hover:text-win-accent-hover">support page</a>
            {' '}or{' '}
            <a href="#" className="text-win-accent hover:text-win-accent-hover">contact us</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DownloadPage;
