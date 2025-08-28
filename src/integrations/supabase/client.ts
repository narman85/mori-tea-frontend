// PocketBase client configuration
import PocketBase from 'pocketbase';

// PocketBase URL - change this if your PocketBase runs on different URL
const POCKETBASE_URL = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';

// Create PocketBase instance
export const pb = new PocketBase(POCKETBASE_URL);

// Enable auto cancellation for pending requests on auth store change
pb.autoCancellation(false);

// For backward compatibility with existing Supabase imports
export const supabase = null; // Deprecated: Use pb instead