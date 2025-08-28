// OAuth configuration for PocketBase
export const OAUTH_CONFIG = {
  redirectUrl: `${window.location.origin}/auth/oauth-callback`,
  
  // PocketBase default redirect URL format
  pocketbaseRedirectUrl: `${process.env.NODE_ENV === 'development' ? (import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090') : window.location.origin}/api/oauth2-redirect`,
  
  // Available OAuth providers
  providers: {
    google: 'google',
    github: 'github',
    facebook: 'facebook'
  }
};

// Utility function to handle OAuth callback
export const handleOAuthCallback = (authData: any) => {
  console.log('OAuth callback received:', authData);
  
  // Store auth data if needed
  if (authData.token) {
    console.log('✅ OAuth successful, token:', authData.token);
  }
  
  return authData;
};

// Get OAuth redirect URL for PocketBase
export const getOAuthRedirectUrl = (provider: string) => {
  const baseUrl = process.env.NODE_ENV === 'development' 
    ? (import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090')
    : window.location.origin;
  
  return `${baseUrl}/api/oauth2-redirect`;
};