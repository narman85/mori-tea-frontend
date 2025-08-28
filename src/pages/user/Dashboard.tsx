import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { pb } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Package, 
  CreditCard, 
  ShoppingBag, 
  TrendingUp, 
  Clock,
  CheckCircle,
  Truck,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { generateOAuthUserId, isOAuthUserId, isOAuthUser } from '@/utils/oauth-helpers';

interface OrderStats {
  total: number;
  pending: number;
  delivered: number;
  totalSpent: number;
}

interface RecentOrder {
  id: string;
  total_price: number;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  created: string;
  expand?: {
    'order_items(order)': Array<{
      quantity: number;
    }>;
  };
}

const Dashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [orderStats, setOrderStats] = useState<OrderStats>({
    total: 0,
    pending: 0,
    delivered: 0,
    totalSpent: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);

  const fetchDashboardData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      const userIsOAuth = isOAuthUser(user);
      console.log('🔍 Dashboard: Current user info:', {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        isOAuth: userIsOAuth,
        oldMethod: isOAuthUserId(user.id),
        fullUserObject: user
      });
      
      // For OAuth users, always search primarily by email since their IDs can change
      let filterQuery;
      
      if (userIsOAuth) {
        // OAuth users: search by user ID AND email (they are real PocketBase users now)
        filterQuery = `(user = "${user.id}" || guest_email = "${user.email}")`;
        console.log('🔍 Dashboard: OAuth user (real PocketBase user), searching by user ID and email:', user.id, user.email);
      } else {
        // Regular user - search by user ID and also check guest orders with same email
        filterQuery = `(user = "${user.id}" || guest_email = "${user.email}")`;
        console.log('🔍 Dashboard: Regular user, searching by ID and email');
      }
      
      console.log('🔍 Dashboard: Fetching orders with filter:', filterQuery);
      
      const allOrders = await pb.collection('orders').getFullList<RecentOrder>({
        filter: filterQuery,
        expand: 'order_items(order)'
      });
      
      console.log('📊 Dashboard: Found orders:', allOrders.length);

      // Calculate statistics
      const stats = allOrders.reduce((acc, order) => {
        acc.total += 1;
        acc.totalSpent += order.total_price;
        
        if (order.status === 'pending' || order.status === 'paid' || order.status === 'processing') {
          acc.pending += 1;
        }
        if (order.status === 'delivered') {
          acc.delivered += 1;
        }
        
        return acc;
      }, { total: 0, pending: 0, delivered: 0, totalSpent: 0 });

      setOrderStats(stats);

      // Get recent orders (last 3) - using same filter logic
      const recent = await pb.collection('orders').getList<RecentOrder>(1, 3, {
        filter: filterQuery,
        sort: '-created',
        expand: 'order_items(order)'
      });

      setRecentOrders(recent.items);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    // Subscribe to real-time order changes for dashboard updates
    if (user) {
      const unsubscribe = pb.collection('orders').subscribe('*', function (e) {
        console.log('Real-time order update for dashboard:', e.action, e.record);
        
        // Only process changes for current user's orders
        if (e.record && e.record.user === user.id) {
          if (e.action === 'update') {
            // Update recent orders if it's in the list
            setRecentOrders(prevOrders =>
              prevOrders.map(order =>
                order.id === e.record.id
                  ? { ...order, status: e.record.status, updated: e.record.updated }
                  : order
              )
            );

            // Recalculate stats when order status changes
            fetchDashboardData();
            
            // Show toast notification for status changes
            const statusText = e.record.status.charAt(0).toUpperCase() + e.record.status.slice(1);
            toast.success(`Order Status Updated`, {
              description: `Order #${e.record.id.slice(-8).toUpperCase()} is now ${statusText}`,
              duration: 5000,
              position: "top-right"
            });
          } else if (e.action === 'create') {
            // Refresh dashboard data when new order is created
            fetchDashboardData();
            
            toast.success('New Order Created', {
              description: `Order #${e.record.id.slice(-8).toUpperCase()} has been created`,
              duration: 5000,
              position: "top-right"
            });
          }
        }
      });

      return () => {
        unsubscribe?.then(unsub => unsub?.());
      };
    }
  }, [user]);

  const getStatusConfig = (status: RecentOrder['status']) => {
    switch (status) {
      case 'pending':
        return { color: 'bg-yellow-100 text-yellow-800', icon: Clock };
      case 'delivered':
        return { color: 'bg-green-100 text-green-800', icon: CheckCircle };
      case 'shipped':
        return { color: 'bg-purple-100 text-purple-800', icon: Truck };
      default:
        return { color: 'bg-blue-100 text-blue-800', icon: Package };
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Overview of your account activity</p>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back, {user?.name || user?.email}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.total}</div>
            <p className="text-xs text-muted-foreground">All time orders</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.pending}</div>
            <p className="text-xs text-muted-foreground">Awaiting delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Orders</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orderStats.delivered}</div>
            <p className="text-xs text-muted-foreground">Successfully delivered</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Spent</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{orderStats.totalSpent.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Lifetime spending</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Orders */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Orders</CardTitle>
              <CardDescription>Your latest order activity</CardDescription>
            </div>
            <Link to="/account/orders">
              <Button variant="outline" size="sm">
                <Eye className="w-4 h-4 mr-2" />
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingBag className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No orders yet</p>
              <Button className="mt-4" onClick={() => window.location.href = '/'}>
                Start Shopping
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {recentOrders.map((order) => {
                const statusConfig = getStatusConfig(order.status);
                const StatusIcon = statusConfig.icon;
                const itemCount = order.expand?.['order_items(order)']?.reduce((sum, item) => sum + item.quantity, 0) || 0;

                return (
                  <div key={order.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex-shrink-0">
                        <Package className="h-8 w-8 text-gray-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          Order #{order.id.slice(-8).toUpperCase()}
                        </p>
                        <p className="text-sm text-gray-500">
                          {itemCount} item{itemCount !== 1 ? 's' : ''} • {new Date(order.created).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge className={statusConfig.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                      <div className="text-sm font-medium">
                        €{order.total_price.toFixed(2)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Manage your account and preferences</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link to="/account/orders" className="block">
              <Button variant="outline" className="w-full justify-start">
                <Package className="w-4 h-4 mr-2" />
                View All Orders
              </Button>
            </Link>
            <Link to="/account/settings" className="block">
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="w-4 h-4 mr-2" />
                Account Settings
              </Button>
            </Link>
            <Button variant="outline" className="w-full justify-start" onClick={() => window.location.href = '/'}>
              <ShoppingBag className="w-4 h-4 mr-2" />
              Continue Shopping
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;