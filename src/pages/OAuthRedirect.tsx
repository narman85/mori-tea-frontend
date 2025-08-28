import React, { useEffect } from 'react';
import { pb } from '@/integrations/supabase/client';

const OAuthRedirect = () => {
  useEffect(() => {
    // This component handles the OAuth redirect from PocketBase
    // After OAuth success, PocketBase will redirect here and auth should be set
    console.log('OAuth redirect received');
    console.log('Auth valid:', pb.authStore.isValid);
    console.log('User:', pb.authStore.model);

    if (pb.authStore.isValid) {
      // OAuth successful, redirect to return URL or home
      const returnUrl = localStorage.getItem('oauth_return_url') || '/';
      localStorage.removeItem('oauth_return_url');
      window.location.href = returnUrl;
    } else {
      // OAuth failed, redirect to auth page
      window.location.href = '/auth';
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p>Completing OAuth...</p>
      </div>
    </div>
  );
};

export default OAuthRedirect;