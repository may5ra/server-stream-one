import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  email: string;
  isAdmin: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  changeEmail: (newEmail: string, password: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Simple hash function for password (not cryptographically secure, but works offline)
const hashPassword = (password: string): string => {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString(16);
};

// Default admin credentials
const DEFAULT_ADMIN = {
  email: 'admin@panel.local',
  passwordHash: hashPassword('admin123'),
};

const STORAGE_KEYS = {
  ADMIN_EMAIL: 'streampanel_admin_email',
  ADMIN_PASSWORD_HASH: 'streampanel_admin_password_hash',
  CURRENT_USER: 'streampanel_current_user',
  IS_INITIALIZED: 'streampanel_initialized',
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize default admin if not exists
  useEffect(() => {
    const isInitialized = localStorage.getItem(STORAGE_KEYS.IS_INITIALIZED);
    if (!isInitialized) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_EMAIL, DEFAULT_ADMIN.email);
      localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH, DEFAULT_ADMIN.passwordHash);
      localStorage.setItem(STORAGE_KEYS.IS_INITIALIZED, 'true');
    }

    // Check for existing session
    const savedUser = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch {
        localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: Error | null }> => {
    const storedEmail = localStorage.getItem(STORAGE_KEYS.ADMIN_EMAIL);
    const storedPasswordHash = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH);
    
    const inputPasswordHash = hashPassword(password);
    
    if (email === storedEmail && inputPasswordHash === storedPasswordHash) {
      const userData: User = { email, isAdmin: true };
      setUser(userData);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(userData));
      return { error: null };
    }
    
    return { error: new Error('Pogrešan email ili lozinka') };
  };

  const signOut = async (): Promise<void> => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  };

  const changePassword = async (currentPassword: string, newPassword: string): Promise<{ error: Error | null }> => {
    const storedPasswordHash = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH);
    const currentHash = hashPassword(currentPassword);
    
    if (currentHash !== storedPasswordHash) {
      return { error: new Error('Trenutna lozinka nije ispravna') };
    }
    
    if (newPassword.length < 6) {
      return { error: new Error('Nova lozinka mora imati najmanje 6 karaktera') };
    }
    
    localStorage.setItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH, hashPassword(newPassword));
    return { error: null };
  };

  const changeEmail = async (newEmail: string, password: string): Promise<{ error: Error | null }> => {
    const storedPasswordHash = localStorage.getItem(STORAGE_KEYS.ADMIN_PASSWORD_HASH);
    const inputHash = hashPassword(password);
    
    if (inputHash !== storedPasswordHash) {
      return { error: new Error('Lozinka nije ispravna') };
    }
    
    localStorage.setItem(STORAGE_KEYS.ADMIN_EMAIL, newEmail);
    
    if (user) {
      const updatedUser = { ...user, email: newEmail };
      setUser(updatedUser);
      localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(updatedUser));
    }
    
    return { error: null };
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      isAdmin: user?.isAdmin ?? false, 
      signIn, 
      signOut,
      changePassword,
      changeEmail
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
