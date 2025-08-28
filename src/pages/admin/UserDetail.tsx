import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { pb } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateOAuthUserId, extractEmailFromOAuthId, isOAuthUserId } from '@/utils/oauth-helpers';
import { 
  ArrowLeft,
  Mail, 
  Calendar,
  Trash2,
  Eye,
  UserCheck,
  UserX,
  ShoppingCart,
  Package
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

interface OAuthUser {
  id: string;
  email: string;
  name: string;
  oauth_provider?: string;
  created: string;
  isOAuth: true;
  username: string;
  verified: boolean;
  collectionId: string;
  collectionName: string;
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

interface UserWithOrders extends (User | OAuthUser) {
  orders?: Order[];
  totalOrders?: number;
  totalSpent?: number;
  isOAuth?: boolean;
  shippingAddresses?: Order['shipping_address'][];
}

const UserDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserWithOrders | null>(null);
  const [loading, setLoading] = useState(true);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    if (id) {
      fetchUser();
    }
  }, [id]);

  const fetchUser = async () => {
    try {
      setLoading(true);
      console.log('🔄 Fetching user details for ID:', id);
      
      let userRecord: UserWithOrders | null = null;
      let orders: Order[] = [];
      
      // Check if this is an OAuth user ID
      if (isOAuthUserId(id)) {
        console.log('🔍 OAuth user detected, extracting from orders...');
        console.log('📧 OAuth ID:', id);
        
        // Try to find orders by searching all guest orders and matching by ID pattern
        const allGuestOrders = await pb.collection('orders').getFullList<Order>({
          filter: `guest_email != ""`,
          sort: '-created'
        });
        
        // Find orders that match this OAuth user by reconstructing the ID from email
        orders = allGuestOrders.filter(order => {
          if (!order.guest_email) return false;
          const reconstructedId = generateOAuthUserId(order.guest_email);
          console.log(`🔍 Comparing ${reconstructedId} with ${id}`);
          return reconstructedId === id;
        });
        
        console.log(`📧 Found ${orders.length} orders matching OAuth ID pattern`);
        
        if (orders.length > 0) {
          // Create virtual OAuth user from first order
          const firstOrder = orders[0];
          const oauthUser: UserWithOrders = {
            id: id,
            username: firstOrder.guest_email || 'oauth-user',
            email: firstOrder.guest_email || 'no-email',
            name: firstOrder.guest_name || firstOrder.shipping_address?.firstName + ' ' + firstOrder.shipping_address?.lastName || 'OAuth User',
            created: firstOrder.created,
            updated: firstOrder.created,
            verified: true,
            emailVisibility: true,
            collectionId: 'oauth',
            collectionName: 'oauth_users',
            isOAuth: true,
            orders,
            totalOrders: orders.length,
            totalSpent: orders.reduce((sum, order) => sum + order.total_price, 0),
            shippingAddresses: []
          };
          
          // Extract unique shipping addresses
          const uniqueAddresses = new Map<string, Order['shipping_address']>();
          orders.forEach(order => {
            if (order.shipping_address) {
              const key = `${order.shipping_address.firstName}_${order.shipping_address.lastName}_${order.shipping_address.address}`;
              uniqueAddresses.set(key, order.shipping_address);
            }
          });
          
          oauthUser.shippingAddresses = Array.from(uniqueAddresses.values());
          
          console.log(`✅ OAuth user created: ${oauthUser.name} with ${orders.length} orders and ${oauthUser.shippingAddresses.length} addresses`);
          userRecord = oauthUser;
        } else {
          throw new Error('OAuth user not found');
        }
      } else {
        // Regular registered user
        console.log('🔍 Regular user, fetching from users collection...');
        const regularUser = await pb.collection('users').getOne<User>(id);
        console.log('✅ Regular user fetched:', regularUser);

        // Fetch orders for this user (both linked and guest orders with same email)
        console.log('🔄 Fetching orders for regular user...');
        orders = await pb.collection('orders').getFullList<Order>({
          filter: `(user = "${id}" || guest_email = "${regularUser.email}")`,
          sort: '-created'
        });
        
        userRecord = {
          ...regularUser,
          isOAuth: false,
          orders,
          totalOrders: orders.length,
          totalSpent: orders.reduce((sum, order) => sum + order.total_price, 0),
          shippingAddresses: []
        };
        
        // Extract unique shipping addresses for regular users too
        const uniqueAddresses = new Map<string, Order['shipping_address']>();
        orders.forEach(order => {
          if (order.shipping_address) {
            const key = `${order.shipping_address.firstName}_${order.shipping_address.lastName}_${order.shipping_address.address}`;
            uniqueAddresses.set(key, order.shipping_address);
          }
        });
        
        userRecord.shippingAddresses = Array.from(uniqueAddresses.values());
      }
      
      const totalSpent = orders.reduce((sum, order) => sum + order.total_price, 0);
      console.log(`📊 User orders: ${orders.length} orders, €${totalSpent.toFixed(2)}`);
      
      setUser(userRecord);
      setUserOrders(orders);
      
    } catch (error) {
      console.error('❌ Error fetching user:', error);
      toast.error('Failed to fetch user details: ' + error.message);
      navigate('/admin/users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!user) return;
    
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await pb.collection('users').delete(user.id);
      toast.success('User deleted successfully');
      navigate('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user');
    }
  };

  const getStatusConfig = (status: Order['status']) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', icon: ShoppingCart };
      case 'paid':
        return { color: 'bg-emerald-100 text-emerald-800', icon: UserCheck };
      case 'processing':
        return { color: 'bg-blue-100 text-blue-800', icon: Package };
      case 'shipped':
        return { color: 'bg-indigo-100 text-indigo-800', icon: Package };
      case 'delivered':
        return { color: 'bg-green-100 text-green-800', icon: UserCheck };
      case 'cancelled':
        return { color: 'bg-red-100 text-red-800', icon: UserX };
      default:
        return { color: 'bg-gray-100 text-gray-800', icon: Package };
    }
  };

  const handleViewOrderDetails = async (order: Order) => {
    try {
      // Fetch order with detailed order items and product information
      const detailedOrder = await pb.collection('orders').getOne(order.id, {
        expand: 'order_items_via_order.product'
      });
      
      setSelectedOrder(detailedOrder);
      setShowOrderDetails(true);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
      toast.error('Failed to load order details: ' + error.message);
    }
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
          <p className="mt-2 text-gray-600">Loading user details...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-gray-600">User not found</p>
          <Button onClick={() => navigate('/admin/users')} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/users')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Users
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Details</h1>
            <p className="text-gray-600">View and manage user information</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleDeleteUser}
          className="text-red-600 hover:text-red-900 border-red-200 hover:border-red-300"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete User
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Information */}
        <div className="bg-white rounded-lg shadow-sm border p-6 space-y-6">
          <h2 className="text-xl font-semibold text-gray-900 border-b pb-3">User Information</h2>
          
          {/* User Avatar */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xl font-medium text-gray-700">
                {(user.name || user.username || user.email).charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {user.name || user.username || 'No name'}
              </h3>
              <p className="text-gray-600">@{user.username}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-sm text-gray-900">{user.email}</span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <div className="flex items-center gap-2">
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
                {user.isOAuth && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    OAuth
                  </span>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Orders</label>
                <div className="flex items-center gap-1">
                  <ShoppingCart className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-900">{user.totalOrders || 0}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Spent</label>
                <span className="text-sm font-medium text-gray-900">€{(user.totalSpent || 0).toFixed(2)}</span>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created</label>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-600">{formatDate(user.created)}</span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Updated</label>
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-600">{formatDate(user.updated)}</span>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">User ID</label>
              <code className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded break-all">
                {user.id}
              </code>
            </div>
          </div>
        </div>

        {/* Shipping Addresses Section - Only for users with addresses */}
        {user.shippingAddresses && user.shippingAddresses.length > 0 && (
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-xl font-semibold text-gray-900 border-b pb-3 mb-4">
              Shipping Addresses ({user.shippingAddresses.length})
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {user.shippingAddresses.map((address, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-medium text-gray-900">Address #{index + 1}</h3>
                    {user.isOAuth && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        OAuth User
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="font-medium text-gray-900">
                        {address.firstName} {address.lastName}
                      </span>
                    </div>
                    
                    <div className="text-gray-600">
                      <div>{address.email}</div>
                      <div>{address.phone}</div>
                    </div>
                    
                    <div className="text-gray-600">
                      <div>{address.address}</div>
                      <div>{address.city}, {address.postalCode}</div>
                      <div>{address.country}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Orders Section */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-xl font-semibold text-gray-900 border-b pb-3 mb-4">Orders & Shipping Info</h2>
          
          {userOrders.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-gray-600">No orders found</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {userOrders.map((order, index) => (
                <div 
                  key={order.id} 
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleViewOrderDetails(order)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium text-sm">Order #{index + 1}</p>
                      <p className="text-xs text-gray-500">ID: {order.id.slice(-8).toUpperCase()}</p>
                      <p className="text-xs text-gray-500">{formatDate(order.created)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">€{order.total_price.toFixed(2)}</p>
                      {(() => {
                        const statusConfig = getStatusConfig(order.status);
                        const StatusIcon = statusConfig.icon;
                        return (
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  
                  {/* Shipping Address */}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="font-medium text-sm mb-2">Shipping Address:</p>
                    <div className="text-xs space-y-1 text-gray-700">
                      <p><span className="font-medium">Name:</span> {order.shipping_address?.firstName} {order.shipping_address?.lastName}</p>
                      <p><span className="font-medium">Email:</span> {order.shipping_address?.email}</p>
                      <p><span className="font-medium">Phone:</span> {order.shipping_address?.phone}</p>
                      <p><span className="font-medium">Address:</span> {order.shipping_address?.address}</p>
                      <p><span className="font-medium">City:</span> {order.shipping_address?.city}, {order.shipping_address?.postalCode}</p>
                      <p><span className="font-medium">Country:</span> {order.shipping_address?.country}</p>
                    </div>
                  </div>
                  
                  {/* Click indicator */}
                  <div className="mt-2 text-center">
                    <p className="text-xs text-blue-600 opacity-75">Click to view order details</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Order Details Modal */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">Order Details</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOrderDetails(false)}
              >
                ×
              </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Order Information */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg border-b pb-2">Order Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Order ID</label>
                  <p className="text-sm text-gray-900 font-mono">#{selectedOrder.id.slice(-8).toUpperCase()}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Customer</label>
                  <p className="text-sm text-gray-900">{selectedOrder.expand?.user?.email || selectedOrder.shipping_address?.email || 'Unknown'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const statusConfig = getStatusConfig(selectedOrder.status);
                      const StatusIcon = statusConfig.icon;
                      return (
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.color}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Total Amount</label>
                  <p className="text-lg font-bold text-green-600">€{selectedOrder.total_price.toFixed(2)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Order Date</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedOrder.created)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                  <p className="text-sm text-gray-900">{formatDate(selectedOrder.updated)}</p>
                </div>

                {/* Shipping Address */}
                <div className="mt-6">
                  <h4 className="font-medium text-lg border-b pb-2 mb-4">Shipping Address</h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="font-medium">{selectedOrder.shipping_address?.firstName} {selectedOrder.shipping_address?.lastName}</p>
                    <p className="text-sm text-gray-600">{selectedOrder.shipping_address?.address}</p>
                    <p className="text-sm text-gray-600">{selectedOrder.shipping_address?.city}, {selectedOrder.shipping_address?.postalCode}</p>
                    <p className="text-sm text-gray-600">{selectedOrder.shipping_address?.country}</p>
                    <div className="pt-2 border-t mt-3">
                      <p className="text-sm text-gray-600">📧 {selectedOrder.shipping_address?.email}</p>
                      <p className="text-sm text-gray-600">📞 {selectedOrder.shipping_address?.phone}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h4 className="font-medium text-lg border-b pb-2">Order Items</h4>
                
                {selectedOrder.expand?.order_items_via_order ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {selectedOrder.expand.order_items_via_order.map((item: any, index: number) => (
                      <div key={item.id} className="border rounded-lg p-4 bg-gray-50">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium text-sm">
                              {item.expand?.product?.name || `Product ${index + 1}`}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {item.expand?.product?.description || 'No description'}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                              <span>Quantity: {item.quantity}</span>
                              <span>Unit Price: €{item.price.toFixed(2)}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">€{(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                        
                        {/* Product Image */}
                        {item.expand?.product?.image && (
                          <div className="mt-3 flex justify-center">
                            <img
                              src={pb.files.getURL(item.expand.product, item.expand.product.image[0])}
                              alt={item.expand?.product?.name}
                              className="w-16 h-16 object-cover rounded"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Package className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-gray-600">No order items found</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 mt-6 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowOrderDetails(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserDetail;