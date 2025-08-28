import { pb } from '@/integrations/supabase/client';

// Cleanup utility to remove temporary OAuth admin users
export const cleanupTempAdminUsers = async () => {
  console.log('🧹 Starting cleanup of temporary admin users...');
  
  try {
    // Get current auth state
    const currentAuth = {
      token: pb.authStore.token,
      model: pb.authStore.model
    };
    
    // Search for temporary admin users
    const tempUsers = await pb.collection('users').getFullList({
      filter: 'email ~ "oauth-admin-" || email ~ "temp-admin-" || name ~ "[TEMP-DELETE]"',
      sort: '-created'
    });
    
    console.log(`Found ${tempUsers.length} temporary admin users to clean up`);
    
    if (tempUsers.length === 0) {
      console.log('✅ No temporary admin users found');
      return { cleaned: 0, errors: 0 };
    }
    
    let cleaned = 0;
    let errors = 0;
    
    for (const user of tempUsers) {
      try {
        console.log(`Deleting temp user: ${user.email} (${user.id})`);
        await pb.collection('users').delete(user.id);
        cleaned++;
        console.log(`✅ Deleted temp user: ${user.email}`);
      } catch (error) {
        console.error(`❌ Failed to delete temp user ${user.email}:`, error);
        errors++;
        
        // Try to mark it for manual deletion
        try {
          await pb.collection('users').update(user.id, {
            name: '[TEMP-DELETE] OAuth Admin - Safe to Delete',
            username: `temp-delete-${user.id}`,
            emailVisibility: false
          });
          console.log(`✅ Marked ${user.email} for manual deletion`);
        } catch (markError) {
          console.error(`❌ Could not mark ${user.email} for deletion:`, markError);
        }
      }
    }
    
    // Restore original auth state
    if (currentAuth.token && currentAuth.model) {
      pb.authStore.save(currentAuth.token, currentAuth.model);
      console.log('🔄 Original auth session restored');
    }
    
    console.log(`🧹 Cleanup completed: ${cleaned} deleted, ${errors} errors`);
    return { cleaned, errors };
    
  } catch (error) {
    console.error('❌ Cleanup process failed:', error);
    return { cleaned: 0, errors: 1 };
  }
};

// Auto cleanup function to run periodically
export const autoCleanupTempUsers = async () => {
  // Only run cleanup if we're authenticated as an admin
  if (pb.authStore.model?.role === 'admin') {
    console.log('🔄 Running automatic temp user cleanup...');
    const result = await cleanupTempAdminUsers();
    if (result.cleaned > 0) {
      console.log(`✅ Auto-cleanup: removed ${result.cleaned} temporary users`);
    }
  }
};