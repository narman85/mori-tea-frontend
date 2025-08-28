// OAuth completion handler
export const handleOAuthCompletion = () => {
  // This function will be called after OAuth redirect
  console.log('🔄 Checking OAuth completion...');
  
  // Check if PocketBase auth is now valid
  const pb = (window as any).pb;
  if (pb?.authStore?.isValid) {
    console.log('✅ OAuth successful! User:', pb.authStore.model);
    
    // Get return URL
    const returnUrl = localStorage.getItem('oauth_return_url') || '/';
    localStorage.removeItem('oauth_return_url');
    
    // Redirect to return URL
    console.log('🔗 Redirecting to:', returnUrl);
    window.location.href = returnUrl;
    
    return true;
  }
  
  console.log('❌ OAuth not completed yet or failed');
  return false;
};

// Check if current page is OAuth redirect
export const isOAuthRedirect = () => {
  const url = new URL(window.location.href);
  return url.searchParams.has('code') && url.searchParams.has('state');
};

// Initialize OAuth completion check (disabled for manual OAuth flow)
export const initOAuthCheck = () => {
  if (isOAuthRedirect()) {
    console.log('🔄 OAuth redirect detected, but using manual flow - OAuthCallback will handle this');
    // Let the OAuthCallback component handle the OAuth flow instead of auto-checking
    return;
  }
};