import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, ShoppingCart, Users, DollarSign, TrendingUp, Clock } from 'lucide-react';
import { pb } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';

interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalSales: number;
  totalUsers: number;
  totalRevenue: number;
}

interface RecentOrder {
  id: string;
  user?: string;
  total_price: number;
  status: string;
  created: string;
  shipping_address?: any;
  expand?: {
    user?: {
      name?: string;
      email?: string;
    };
    'order_items(order)'?: any[];
  };
}

interface TopProduct {
  id: string;
  name: string;
  totalSold: number;
  image?: string[];
  price: number;
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalProducts: 0,
    totalOrders: 0,
    totalSales: 0,
    totalUsers: 0,
    totalRevenue: 0
  });
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const getTopSellingProducts = async (): Promise<TopProduct[]> => {
    try {
      // Get all order items with product info
      const orderItems = await pb.collection('order_items').getFullList({
        expand: 'product'
      });

      // Group all order items by product
      const productSales: { [key: string]: { product: any; totalSold: number } } = {};
      
      orderItems.forEach(item => {
        if (item.expand?.product) {
          const productId = item.expand.product.id;
          const quantity = item.quantity || 0;
          
          if (productSales[productId]) {
            productSales[productId].totalSold += quantity;
          } else {
            productSales[productId] = {
              product: item.expand.product,
              totalSold: quantity
            };
          }
        }
      });

      // Convert to array and sort by total sold
      const topProducts = Object.values(productSales)
        .map(item => ({
          id: item.product.id,
          name: item.product.name,
          totalSold: item.totalSold,
          image: item.product.image,
          // Use sale_price if available and valid, otherwise use regular price
          price: (item.product.sale_price && item.product.sale_price > 0 && item.product.sale_price < item.product.price) 
            ? item.product.sale_price 
            : item.product.price || 0
        }))
        .sort((a, b) => b.totalSold - a.totalSold)
        .slice(0, 5); // Top 5 products

      return topProducts;
    } catch (error) {
      console.error('Error getting top selling products:', error);
      return [];
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch products count and stock info
      const products = await pb.collection('products').getFullList({
        fields: 'id,stock'
        // Show all products, even those with 0 stock
      });

      // Fetch orders data with expanded user info and order items
      const orders = await pb.collection('orders').getFullList<RecentOrder>({
        sort: '-created',
        expand: 'user,order_items(order)'
      });
      
      console.log('Orders data:', orders);
      if (orders.length > 0) {
        console.log('First order structure:', orders[0]);
        console.log('Order keys:', Object.keys(orders[0]));
      }

      // Fetch users count
      const users = await pb.collection('users').getFullList({
        fields: 'id'
      });

      // Calculate total revenue from all orders
      const totalRevenue = orders.reduce((sum, order) => {
        return sum + (order.total_price || 0);
      }, 0);

      // Calculate total products sold (sum of all quantities from all order items)
      let totalProductsSold = 0;
      try {
        // Get all order items
        const orderItems = await pb.collection('order_items').getFullList();
        
        // Sum all quantities from all order items
        totalProductsSold = orderItems.reduce((total, item) => {
          return total + (item.quantity || 0);
        }, 0);
        
        console.log('Total products sold:', totalProductsSold);
      } catch (error) {
        console.error('Error calculating total products sold:', error);
      }

      // Get recent orders (last 10)
      const recentOrdersList = orders.slice(0, 10);

      setStats({
        totalProducts: products.length,
        totalOrders: orders.length, // Total count of all orders
        totalSales: totalProductsSold, // Total products sold
        totalUsers: users.length,
        totalRevenue: totalRevenue // Total revenue from all orders
      });

      setRecentOrders(recentOrdersList);
      
      // Get top selling products
      const topSellingProducts = await getTopSellingProducts();
      setTopProducts(topSellingProducts);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Get customer email - either from user account or shipping address (for guest users)
  const getCustomerEmail = (order: RecentOrder) => {
    // If user is logged in and has an email, use that
    if (order.expand?.user?.email) {
      return order.expand.user.email;
    }
    
    // For guest users, use the shipping address email
    if (order.shipping_address?.email) {
      return order.shipping_address.email;
    }
    
    // Last fallback - always use shipping email as it's always recorded
    return 'No email provided';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600">Manage your e-commerce store</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Products</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalProducts}</div>
            <p className="text-xs text-muted-foreground">Products in store</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalOrders}</div>
            <p className="text-xs text-muted-foreground">Orders placed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalSales}</div>
            <p className="text-xs text-muted-foreground">Products sold</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{loading ? '...' : formatCurrency(stats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Total earnings</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest orders from customers</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-gray-500">Loading orders...</div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No orders yet</div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex flex-col space-y-1">
                      <div className="flex items-center space-x-2">
                        <Badge className={`text-xs ${getStatusColor(order.status)}`}>
                          {order.status}
                        </Badge>
                        <span className="text-sm text-gray-500">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {formatDate(order.created)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {getCustomerEmail(order)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {order.expand?.['order_items(order)']?.length || 0} items
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-green-600">
                        {formatCurrency(order.total_price || 0)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Selling Products</CardTitle>
            <CardDescription>Best performing products by sales</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-6 text-gray-500">Loading products...</div>
            ) : topProducts.length === 0 ? (
              <div className="text-center py-6 text-gray-500">No sales data yet</div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{product.name}</p>
                        <p className="text-sm text-gray-500">{formatCurrency(product.price)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-green-600">{product.totalSold} sold</p>
                      <p className="text-sm text-gray-500">units</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;