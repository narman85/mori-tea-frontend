import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { pb } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateOAuthUserId } from '@/utils/oauth-helpers';
import { 
  Users, 
  Mail, 
  Calendar,
  Search,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  ShoppingCart,
  Package,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  username: string;
  email: string;
  name?: string;
  avatar?: string;
  created: string;
  updated: string;
  verified: boolean;
  emailVisibility: boolean;
  collectionId: string;
  collectionName: string;
}

interface UserStats {
  totalUsers: number;
  verifiedUsers: number;
  recentUsers: number;
}

interface Order {
  id: string;
  user?: string;
  total_price: number;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  shipping_address: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    postalCode: string;
    country: string;
  };
  guest_email?: string;
  guest_name?: string;
  created: string;
  updated: string;
}

interface OAuthUser {
  id: string;
  email: string;
  name: string;
  oauth_provider?: string;
  created: string;
  isOAuth: true;
}

interface UserWithOrders extends User {
  orders?: Order[];
  totalOrders?: number;
  totalSpent?: number;
  isOAuth?: boolean;
}

interface OAuthUserWithOrders extends OAuthUser {
  orders?: Order[];
  totalOrders?: number;
  totalSpent?: number;
}

const UsersManagement = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserWithOrders[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserWithOrders[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<UserStats>({
    totalUsers: 0,
    verifiedUsers: 0,
    recentUsers: 0
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Auto refresh when window comes back into focus
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 Window focused, refreshing users...');
      setUsers([]);
      setFilteredUsers([]);
      setLoading(true);
      fetchUsers();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  useEffect(() => {
    // Filter users based on search term
    if (searchTerm.trim() === '') {
      setFilteredUsers(users);
    } else {
      const filtered = users.filter(user =>
        user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching users...');
      
      // Fetch regular registered users
      const records = await pb.collection('users').getFullList<User>({
        sort: '-created'
      });
      
      console.log('✅ Regular users fetched:', records.length);
      
      // Fetch all orders to find OAuth users from guest orders
      console.log('🔄 Fetching all orders to find OAuth users...');
      const allOrders = await pb.collection('orders').getFullList<Order>({
        filter: 'guest_email != ""',
        sort: '-created'
      });
      
      // Extract unique OAuth users from orders
      const oauthUserEmails = new Set<string>();
      const oauthUsersMap = new Map<string, OAuthUserWithOrders>();
      
      allOrders.forEach(order => {
        if (order.guest_email && !oauthUserEmails.has(order.guest_email)) {
          oauthUserEmails.add(order.guest_email);
          
          // Check if this email belongs to a registered user
          const isRegisteredUser = records.some(user => user.email === order.guest_email);
          
          if (!isRegisteredUser) {
            // This is a pure OAuth user
            const oauthUser: OAuthUserWithOrders = {
              id: generateOAuthUserId(order.guest_email), // Use consistent ID generation
              email: order.guest_email,
              name: order.guest_name || order.shipping_address?.firstName + ' ' + order.shipping_address?.lastName || 'OAuth User',
              oauth_provider: 'google', // Assume Google for now
              created: order.created,
              isOAuth: true,
              orders: [],
              totalOrders: 0,
              totalSpent: 0
            };
            
            oauthUsersMap.set(order.guest_email, oauthUser);
          }
        }
      });
      
      console.log(`✅ Found ${oauthUsersMap.size} OAuth users`);

      // Fetch orders for regular users
      console.log('🔄 Fetching orders for regular users...');
      const usersWithOrders = await Promise.all(
        records.map(async (user) => {
          try {
            // Get orders for this user (both linked to user ID and guest orders with same email)
            const orders = await pb.collection('orders').getFullList<Order>({
              filter: `(user = "${user.id}" || guest_email = "${user.email}")`,
              sort: '-created'
            });
            
            const totalSpent = orders.reduce((sum, order) => sum + order.total_price, 0);
            
            console.log(`📊 User ${user.username}: ${orders.length} orders, €${totalSpent.toFixed(2)}`);
            
            return {
              ...user,
              orders,
              totalOrders: orders.length,
              totalSpent,
              isOAuth: false
            };
          } catch (error) {
            console.error(`❌ Error fetching orders for user ${user.id}:`, error);
            return {
              ...user,
              orders: [],
              totalOrders: 0,
              totalSpent: 0,
              isOAuth: false
            };
          }
        })
      );

      // Fetch orders for OAuth users
      console.log('🔄 Fetching orders for OAuth users...');
      for (const [email, oauthUser] of oauthUsersMap.entries()) {
        try {
          const orders = await pb.collection('orders').getFullList<Order>({
            filter: `guest_email = "${email}"`,
            sort: '-created'
          });
          
          const totalSpent = orders.reduce((sum, order) => sum + order.total_price, 0);
          
          oauthUser.orders = orders;
          oauthUser.totalOrders = orders.length;
          oauthUser.totalSpent = totalSpent;
          
          console.log(`📊 OAuth User ${email}: ${orders.length} orders, €${totalSpent.toFixed(2)}`);
        } catch (error) {
          console.error(`❌ Error fetching orders for OAuth user ${email}:`, error);
        }
      }

      // Combine regular users and OAuth users
      const combinedUsers = [
        ...usersWithOrders,
        ...Array.from(oauthUsersMap.values()).map(oauthUser => ({
          ...oauthUser,
          username: oauthUser.email,
          avatar: undefined,
          updated: oauthUser.created,
          verified: true, // OAuth users are considered verified
          emailVisibility: true,
          collectionId: 'oauth',
          collectionName: 'oauth_users'
        } as UserWithOrders))
      ];

      setUsers(combinedUsers);
      
      // Calculate stats including OAuth users
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const stats = {
        totalUsers: combinedUsers.length,
        verifiedUsers: combinedUsers.filter(user => user.verified || user.isOAuth).length,
        recentUsers: combinedUsers.filter(user => new Date(user.created) > oneWeekAgo).length
      };
      
      console.log(`📊 Total users: ${stats.totalUsers} (${records.length} registered + ${oauthUsersMap.size} OAuth)`);
      
      setStats(stats);
      console.log('✅ Users management loaded successfully');
      
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      toast.error('Failed to fetch users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    const isOAuthUser = user?.isOAuth || false;
    
    const confirmMessage = isOAuthUser 
      ? 'Are you sure you want to delete this OAuth user? This will delete all their orders. This action cannot be undone.'
      : 'Are you sure you want to delete this user? This action cannot be undone.';
    
    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      if (isOAuthUser) {
        // OAuth user - delete all their orders (they don't exist in users table)
        console.log('🗑️ Deleting OAuth user orders for:', user?.email);
        
        // Find and delete all orders for this OAuth user
        const userOrders = await pb.collection('orders').getFullList({
          filter: `guest_email = "${user?.email}"`
        });
        
        console.log(`🗑️ Found ${userOrders.length} orders to delete for OAuth user`);
        
        // Delete order items first, then orders
        for (const order of userOrders) {
          try {
            // Delete order items
            const orderItems = await pb.collection('order_items').getFullList({
              filter: `order = "${order.id}"`
            });
            
            for (const item of orderItems) {
              await pb.collection('order_items').delete(item.id);
            }
            
            // Delete the order
            await pb.collection('orders').delete(order.id);
            console.log(`✅ Deleted order ${order.id} and its items`);
          } catch (orderError) {
            console.error(`❌ Error deleting order ${order.id}:`, orderError);
          }
        }
        
        toast.success(`OAuth user and ${userOrders.length} orders deleted successfully`);
      } else {
        // Regular user - delete from users table
        await pb.collection('users').delete(userId);
        toast.success('User deleted successfully');
      }
      
      // Remove from UI
      setUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      setFilteredUsers(prevUsers => prevUsers.filter(user => user.id !== userId));
      
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user: ' + (error.message || 'Unknown error'));
    }
  };

  const handleViewUser = (user: UserWithOrders) => {
    navigate(`/admin/users/${user.id}`);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
          <p className="text-gray-600">Manage registered users and view their information</p>
        </div>
        <Button 
          onClick={() => {
            setUsers([]);
            setFilteredUsers([]);
            setLoading(true);
            fetchUsers();
          }}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Verified Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.verifiedUsers}</p>
            </div>
            <UserCheck className="h-8 w-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Recent (7 days)</p>
              <p className="text-2xl font-bold text-gray-900">{stats.recentUsers}</p>
            </div>
            <Calendar className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search users by username, email, or name..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            Users ({filteredUsers.length})
          </h2>
        </div>
        
        {filteredUsers.length === 0 ? (
          <div className="p-6 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-600">
              {searchTerm ? 'No users found matching your search.' : 'No users found.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mobile/Responsive Cards */}
            <div className="block lg:hidden">
              {filteredUsers.map((user) => (
                <div key={user.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-medium text-gray-700">
                          {(user.name || user.username || user.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-medium text-gray-900 truncate">
                            {user.name || user.username || 'No name'}
                          </h3>
                          {user.isOAuth && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              OAuth
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {user.isOAuth ? user.email : `@${user.username}`}
                        </p>
                        <p className="text-xs text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewUser(user)}
                        className="mb-2"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Status:</span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          user.verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {user.verified ? (
                            <>
                              <UserCheck className="h-3 w-3 mr-1" />
                              Verified
                            </>
                          ) : (
                            <>
                              <UserX className="h-3 w-3 mr-1" />
                              Unverified
                            </>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-500">Orders:</span>
                      <div className="flex items-center gap-1 mt-1">
                        <ShoppingCart className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{user.totalOrders || 0}</span>
                      </div>
                    </div>
                    
                    <div>
                      <span className="text-gray-500">Total Spent:</span>
                      <p className="font-medium text-gray-900 mt-1">€{(user.totalSpent || 0).toFixed(2)}</p>
                    </div>
                    
                    <div>
                      <span className="text-gray-500">Created:</span>
                      <p className="text-xs text-gray-600 mt-1">{formatDate(user.created)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                      Orders
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                      Spent
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-gray-700">
                            {(user.name || user.username || user.email).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {user.name || user.username || 'No name'}
                            </div>
                            {user.isOAuth && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 flex-shrink-0">
                                OAuth
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {user.isOAuth ? user.email : `@${user.username}`}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900">
                        {user.email || 'No email'}
                        {!user.email && (
                          <span className="text-xs text-red-500 ml-1">(missing)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.verified 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {user.verified ? (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            Verified
                          </>
                        ) : (
                          <>
                            <UserX className="h-3 w-3 mr-1" />
                            Unverified
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <ShoppingCart className="h-4 w-4 text-gray-400 mr-1" />
                        {user.totalOrders || 0}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="font-medium">
                        €{(user.totalSpent || 0).toFixed(2)}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="text-xs">{formatDate(user.created)}</div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewUser(user)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteUser(user.id)}
                          className="text-red-600 hover:text-red-900 border-red-200 hover:border-red-300"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersManagement;