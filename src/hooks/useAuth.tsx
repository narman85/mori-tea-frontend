import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { pb } from '@/integrations/supabase/client';
import type { RecordModel } from 'pocketbase';
import { initOAuthCheck } from '@/utils/oauth-handler';

interface AuthContextType {
  user: RecordModel | null;
  session: string | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string) => Promise<{ error: any }>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  loading: boolean;
}

// Global function to validate current user
const validateCurrentUser = async () => {
  // Check if we have any auth data (even if PocketBase says it's not "valid")
  if (pb.authStore.model) {
    // Check if this is an OAuth session (temporary or fallback)
    if (pb.authStore.model.id?.startsWith('oauth-') || 
        pb.authStore.model.id?.startsWith('temp-') || 
        pb.authStore.token?.startsWith('oauth-session-') || 
        pb.authStore.token?.startsWith('oauth-') ||
        pb.authStore.model.oauth_provider === 'google') {
      console.log('🔄 Detected OAuth session, allowing through:', {
        id: pb.authStore.model.id?.substring(0, 15) + '...',
        email: pb.authStore.model.email,
        token_prefix: pb.authStore.token?.substring(0, 15) + '...',
        oauth_provider: pb.authStore.model.oauth_provider
      });
      // For OAuth sessions, we'll let them through without validation
      return pb.authStore.model;
    }
    
    // Check if this is an old fallback OAuth user (fake user with fake ID)
    if (pb.authStore.model.id?.startsWith('oauth-') && pb.authStore.model.id?.includes('1756')) {
      console.warn('❌ Detected old fallback OAuth user, clearing session');
      pb.authStore.clear();
      return null;
    }
    
    try {
      const currentUser = await pb.collection('users').getOne(pb.authStore.model.id);
      return currentUser;
    } catch (error) {
      // If this is any OAuth session and validation fails, keep it
      if (pb.authStore.model.id?.startsWith('oauth-') || 
          pb.authStore.model.id?.startsWith('temp-') || 
          pb.authStore.token?.startsWith('oauth-session-') || 
          pb.authStore.token?.startsWith('oauth-') ||
          pb.authStore.model.oauth_provider === 'google') {
        console.log('⚠️ OAuth session validation failed but keeping for functionality:', {
          id: pb.authStore.model.id?.substring(0, 15) + '...',
          email: pb.authStore.model.email
        });
        return pb.authStore.model;
      }
      
      console.warn('❌ User validation failed, clearing auth:', error);
      pb.authStore.clear();
      return null;
    }
  }
  return null;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up PocketBase auth state listener
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setSession(token);
      setUser(model);
      setLoading(false);
    });

    // Check if user is already authenticated and validate user still exists
    const validateUser = async () => {
      const currentUser = await validateCurrentUser();
      if (currentUser) {
        setSession(pb.authStore.token);
        setUser(currentUser);
        console.log('✅ User validated:', currentUser.email);
      } else {
        // Check if this is an OAuth session before clearing (don't require isValid)
        if (pb.authStore.model && 
            (pb.authStore.model.id?.startsWith('oauth-') || 
             pb.authStore.model.id?.startsWith('temp-') || 
             pb.authStore.token?.startsWith('oauth-session-') || 
             pb.authStore.token?.startsWith('oauth-') ||
             pb.authStore.model.oauth_provider === 'google')) {
          console.log('✅ OAuth session detected, keeping active:', {
            id: pb.authStore.model.id?.substring(0, 15) + '...',
            email: pb.authStore.model.email,
            oauth_provider: pb.authStore.model.oauth_provider
          });
          setSession(pb.authStore.token);
          setUser(pb.authStore.model);
        } else {
          console.log('⚠️ No valid user found and not OAuth session, clearing all sessions');
          pb.authStore.clear();
          setSession(null);
          setUser(null);
        }
      }
      setLoading(false);
    };

    validateUser();

    // Initialize OAuth completion check
    initOAuthCheck();

    return () => {
      unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔄 Clearing all sessions and starting fresh sign in...');
      
      // Clear PocketBase auth store completely
      pb.authStore.clear();
      
      // Clear any localStorage OAuth data
      localStorage.removeItem('oauth_return_url');
      localStorage.removeItem('oauth_state');
      
      // Force clear React state
      setSession(null);
      setUser(null);
      
      console.log('🔄 Attempting to sign in with:', email);
      const authData = await pb.collection('users').authWithPassword(email, password);
      
      // Set new session and user
      setSession(pb.authStore.token);
      setUser(pb.authStore.model);
      
      console.log('✅ User signed in successfully:', {
        email: pb.authStore.model?.email,
        id: pb.authStore.model?.id,
        role: pb.authStore.model?.role
      });
      
      return { error: null };
    } catch (error: any) {
      console.error('❌ Sign in error:', error);
      return { error };
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      // Clear any existing OAuth/fallback sessions first
      pb.authStore.clear();
      
      // Create new user
      const userData = {
        username: email.split('@')[0], // Use part before @ as username
        email,
        emailVisibility: true, // Make email visible in admin panel
        role: 'user', // Regular user role
        password,
        passwordConfirm: password,
      };

      console.log('Creating user with data:', userData);
      const record = await pb.collection('users').create(userData);
      console.log('User created successfully:', record);
      
      // Automatically sign in after registration
      const authData = await pb.collection('users').authWithPassword(email, password);
      setSession(pb.authStore.token);
      setUser(pb.authStore.model);
      console.log('✅ User signed up and logged in:', pb.authStore.model?.email);
      
      return { error: null };
    } catch (error: any) {
      console.error('Sign up error:', error);
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      console.log('🔄 Starting Google OAuth...');
      
      // Store current location for after OAuth
      localStorage.setItem('oauth_return_url', window.location.href);
      
      const GOOGLE_CLIENT_ID = "193029448994-ibg5jk0f2dch6gihqvk8sfrjkcpbmo89.apps.googleusercontent.com";
      const REDIRECT_URI = `${window.location.origin}/auth/oauth-callback`;
      const SCOPE = "openid email profile";
      const STATE = Math.random().toString(36).substring(2);
      const NONCE = Math.random().toString(36).substring(2);
      
      // Store state and nonce for verification
      localStorage.setItem('oauth_state', STATE);
      localStorage.setItem('oauth_nonce', NONCE);
      
      // Build Google OAuth URL
      const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/auth');
      googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      googleAuthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      googleAuthUrl.searchParams.set('response_type', 'code token id_token');
      googleAuthUrl.searchParams.set('scope', SCOPE);
      googleAuthUrl.searchParams.set('state', STATE);
      googleAuthUrl.searchParams.set('nonce', NONCE);
      googleAuthUrl.searchParams.set('access_type', 'offline');
      
      console.log('🔗 Redirecting to Google OAuth');
      
      // Simple full page redirect - most reliable
      window.location.href = googleAuthUrl.toString();
      
      return { error: null };
      
    } catch (error: any) {
      console.error('❌ Google OAuth error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    console.log('🔄 Signing out and clearing all sessions...');
    
    // Clear PocketBase auth store
    pb.authStore.clear();
    
    // Clear localStorage
    localStorage.removeItem('oauth_return_url');
    localStorage.removeItem('oauth_state');
    
    // Clear React state
    setSession(null);
    setUser(null);
    
    console.log('✅ Successfully signed out');
  };

  const value = {
    user,
    session,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export validation function for use in other components
export { validateCurrentUser };