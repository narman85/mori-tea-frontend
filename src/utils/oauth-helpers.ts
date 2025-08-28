// OAuth user ID generation utility
export const generateOAuthUserId = (email: string): string => {
  // Consistent OAuth ID generation across the app
  return `oauth-${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
};

export const extractEmailFromOAuthId = (oauthId: string): string => {
  if (!oauthId.startsWith('oauth-')) return '';
  
  // Reverse the transformation
  const emailPart = oauthId.replace('oauth-', '');
  // This is a simplified reverse - might not be perfect for complex emails
  return emailPart.replace(/_/g, '.');
};

export const isOAuthUserId = (userId: string): boolean => {
  return userId.startsWith('oauth-') || userId.startsWith('temp-') || userId.startsWith('google-');
};

// Better way to detect OAuth users - by checking user object properties
export const isOAuthUser = (user: any): boolean => {
  // Check if user has OAuth characteristics:
  // 1. Username contains timestamp pattern (OAuth auto-generated)
  // 2. Has email and name from OAuth provider
  // 3. Username is auto-generated format: email-based + timestamp
  
  if (!user) return false;
  
  // First check the old way (for temp/oauth prefixed IDs)
  if (user.id && (user.id.startsWith('oauth-') || user.id.startsWith('temp-') || user.id.startsWith('google-'))) {
    return true;
  }
  
  // Check for OAuth auto-generated username pattern
  // OAuth users get usernames like: nariman-works-175629260159 (email-based + timestamp)
  if (user.username && user.email) {
    const emailPart = user.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '-');
    const usernameStartsWithEmail = user.username.startsWith(emailPart);
    const hasTimestamp = /\d{10,}/.test(user.username); // Contains 10+ digit timestamp
    
    if (usernameStartsWithEmail && hasTimestamp) {
      console.log('🔍 Detected OAuth user by username pattern:', user.username);
      return true;
    }
  }
  
  // Fallback: check if username looks auto-generated and has email/name
  const hasAutoGenUsername = user.username && user.username.includes('-') && /\d+$/.test(user.username);
  const hasName = user.name && user.name.trim().length > 0;
  const hasEmail = user.email && user.email.includes('@');
  
  return hasAutoGenUsername && hasName && hasEmail;
};