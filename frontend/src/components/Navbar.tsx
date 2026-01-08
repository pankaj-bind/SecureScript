import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useProfile } from '../contexts/ProfileContext'; // Add this import

// SVG Icons for the theme toggle button (Windows 11 style)
const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

const Navbar: React.FC = () => {
  const { token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { profilePicture, displayName } = useProfile(); // Add this to get DP from context
  const navigate = useNavigate();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
    navigate('/login');
  };

  const closeMenus = () => {
    setIsMobileMenuOpen(false);
    setIsUserDropdownOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userDropdownRef]);

  return (
    <nav className="win-navbar">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" onClick={closeMenus} className="flex items-center flex-shrink-0 group">
            <svg className="h-7 w-7 text-win-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span className="ml-2 text-lg font-semibold text-win-text-primary">SecureScript</span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-1">
            <div className="flex items-center">
              <Link to="/" className="px-3 py-1.5 rounded-win text-sm font-medium text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">Home</Link>
              {token && <Link to="/dashboard" className="px-3 py-1.5 rounded-win text-sm font-medium text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">Dashboard</Link>}
              <Link to="/updates" className="px-3 py-1.5 rounded-win text-sm font-medium text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">New Updates</Link>
            </div>
            
            <div className="flex items-center ml-4 space-x-1">
              <button 
                onClick={toggleTheme} 
                className="p-2 rounded-win text-win-text-tertiary hover:bg-win-bg-hover transition-colors duration-150"
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? <MoonIcon /> : <SunIcon />}
              </button>
              
              {token ? (
                <div className="relative ml-2" ref={userDropdownRef}>
                  <button 
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)} 
                    className="flex items-center rounded-full focus:outline-none focus:ring-2 focus:ring-win-accent focus:ring-offset-2"
                  >
                    <img 
                      className="h-8 w-8 rounded-full border-2 border-transparent hover:border-win-accent transition-colors duration-150" 
                      src={profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=128&background=60cdff&color=fff`} 
                      alt="User profile" 
                    />
                  </button>
                  {isUserDropdownOpen && (
                    <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-win-lg shadow-win-flyout py-1 bg-win-bg-layer border border-win-border-default backdrop-blur-win z-50">
                      <div className="px-4 py-3 border-b border-win-border-default">
                        <p className="text-sm font-medium text-win-text-primary">Your Account</p>
                      </div>
                      <Link to="/dashboard" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">
                        <svg className="w-4 h-4 mr-3 text-win-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                        Dashboard
                      </Link>
                      <Link to="/profile" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">
                        <svg className="w-4 h-4 mr-3 text-win-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        Profile
                      </Link>
                      <Link to="#" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center px-4 py-2.5 text-sm text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">
                        <svg className="w-4 h-4 mr-3 text-win-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        Settings
                      </Link>
                      <div className="border-t border-win-border-default mt-1">
                        <button onClick={handleLogout} className="flex items-center w-full px-4 py-2.5 text-sm text-red-500 hover:bg-win-bg-hover transition-colors duration-150">
                          <svg className="w-4 h-4 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                          Sign out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center space-x-2 ml-2">
                  <Link to="/login" className="px-3 py-1.5 rounded-win text-sm font-medium text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">Log in</Link>
                  <Link to="/register" className="win-btn-primary px-4 py-1.5 rounded-win text-sm font-medium">Sign up</Link>
                </div>
              )}
            </div>
          </div>
          
          {/* Mobile Menu Button & Theme Toggle */}
          <div className="md:hidden flex items-center">
            <button onClick={toggleTheme} className="p-2 rounded-win text-win-text-tertiary hover:bg-win-bg-hover mr-1 transition-colors duration-150">
              {theme === 'light' ? <MoonIcon /> : <SunIcon />}
            </button>
            <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="inline-flex items-center justify-center p-2 rounded-win text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">
              {isMobileMenuOpen ? ( <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg> ) : ( <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg> )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-win-border-default bg-win-bg-layer backdrop-blur-win">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="text-win-text-secondary hover:bg-win-bg-hover block px-3 py-2 rounded-win text-sm font-medium transition-colors duration-150">Home</Link>
            {token && <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="text-win-text-secondary hover:bg-win-bg-hover block px-3 py-2 rounded-win text-sm font-medium transition-colors duration-150">Dashboard</Link>}
            <Link to="/updates" onClick={() => setIsMobileMenuOpen(false)} className="text-win-text-secondary hover:bg-win-bg-hover block px-3 py-2 rounded-win text-sm font-medium transition-colors duration-150">New Updates</Link>
          </div>
          <div className="pt-4 pb-3 border-t border-win-border-default">
            {token ? (
              <>
                <div className="flex items-center px-5">
                  <div className="flex-shrink-0">
                    <img className="h-10 w-10 rounded-full" src={profilePicture || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&size=128&background=60cdff&color=fff`} alt="" />
                  </div>
                  <div className="ml-3">
                    <div className="text-sm font-medium text-win-text-primary">Your Account</div>
                  </div>
                </div>
                <div className="mt-3 px-2 space-y-1">
                  <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 rounded-win text-sm font-medium text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">Dashboard</Link>
                  <Link to="/profile" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 rounded-win text-sm font-medium text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">Profile</Link>
                  <Link to="#" onClick={() => setIsMobileMenuOpen(false)} className="block px-3 py-2 rounded-win text-sm font-medium text-win-text-secondary hover:bg-win-bg-hover transition-colors duration-150">Settings</Link>
                  <button onClick={handleLogout} className="w-full text-left block px-3 py-2 rounded-win text-sm font-medium text-red-500 hover:bg-win-bg-hover transition-colors duration-150">Sign out</button>
                </div>
              </>
            ) : (
              <div className="px-5 space-y-3">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center win-btn-primary py-2 rounded-win text-sm font-medium">Log in</Link>
                <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="block w-full text-center text-win-accent border border-win-accent px-4 py-2 rounded-win text-sm font-medium hover:bg-win-bg-hover transition-colors duration-150">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
