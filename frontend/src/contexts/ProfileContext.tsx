import React, { createContext, useContext, useState } from 'react';

interface ProfileContextType {
  profilePicture: string | null;
  setProfilePicture: (url: string | null) => void;
  email: string;
  setEmail: (email: string) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const [email, setEmail] = useState<string>('');

  return (
    <ProfileContext.Provider value={{ profilePicture, setProfilePicture, email, setEmail }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
