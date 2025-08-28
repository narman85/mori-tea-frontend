import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, EyeOff, Eye, Package, GripVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { pb } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import SimpleDragCard from '@/components/admin/SimpleDragCard';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  in_stock: boolean;
  stock?: number;
  image: string[];
  created: string;
  updated: string;
  display_order?: number;
  order_count?: number;
  total_sold?: number;
  hidden?: boolean;
  preparation?: {
    amount: string;
    temperature: string;
    steepTime: string;
    taste: string;
  };
}

const ProductsManagement = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch products from PocketBase
  const fetchProducts = async () => {
    try {
      setLoading(true);
      console.log('Fetching products from PocketBase... V2');
      const records = await pb.collection('products').getFullList<Product>({
        sort: '-display_order,-created',
        requestKey: `products-${Date.now()}` // Force fresh fetch
      });
      console.log('Fetched products:', records.length);
      
      // Debug: Log ALL products stock info to find Earl Grey issue
      records.forEach((record, index) => {
        console.log(`Product ${index + 1}: ${record.name}`, {
          id: record.id,
          stock: record.stock,
          in_stock: record.in_stock,
          stockType: typeof record.stock
        });
        
        // Special focus on Earl Grey
        if (record.name.toLowerCase().includes('earl grey')) {
          console.log('🔍 EARL GREY DEBUG:', JSON.stringify(record, null, 2));
        }
      });
      
      // Get order counts and total sales quantity for each product
      const orderStatsPromises = records.map(async (record) => {
        try {
          const orderItems = await pb.collection('order_items').getFullList({
            filter: `product = "${record.id}"`,
            fields: 'id,quantity'
          });
          
          const totalQuantity = orderItems.reduce((sum, item) => {
            const quantity = Number(item.quantity) || 0;
            return sum + quantity;
          }, 0);
          
          return { 
            productId: record.id, 
            count: orderItems.length,
            totalSold: totalQuantity 
          };
        } catch (error) {
          console.warn('Could not fetch order stats for product:', record.name, error);
          return { 
            productId: record.id, 
            count: 0,
            totalSold: 0 
          };
        }
      });

      const orderStats = await Promise.all(orderStatsPromises);
      const orderStatsMap = orderStats.reduce((acc, item) => {
        acc[item.productId] = { count: item.count, totalSold: item.totalSold };
        return acc;
      }, {} as Record<string, { count: number; totalSold: number }>);

      // Process the records to handle preparation data and ensure stock is a number
      const processedRecords = records.map(record => {
        // Ensure stock is a proper number
        if (record.stock !== undefined && record.stock !== null) {
          record.stock = Number(record.stock);
          if (isNaN(record.stock)) {
            console.warn('Invalid stock value for product:', record.name, record.stock);
            record.stock = 0;
          }
        }
        
        // Add order stats
        const stats = orderStatsMap[record.id] || { count: 0, totalSold: 0 };
        record.order_count = stats.count;
        record.total_sold = stats.totalSold;
        
        if (record.preparation && typeof record.preparation === 'string') {
          try {
            record.preparation = JSON.parse(record.preparation);
          } catch (parseError) {
            console.warn('Could not parse preparation data for product:', record.id, parseError);
            record.preparation = undefined;
          }
        }
        return record;
      });
      
      setProducts(processedRecords);
    } catch (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Failed to load products",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Edit product
  const editProduct = (product: Product) => {
    navigate(`/admin/products/edit/${product.id}`);
  };

  // Move product (drag & drop)
  const moveProduct = async (dragIndex: number, hoverIndex: number) => {
    const draggedProduct = products[dragIndex];
    
    // Update local state immediately for smooth UX
    const updatedProducts = [...products];
    updatedProducts.splice(dragIndex, 1);
    updatedProducts.splice(hoverIndex, 0, draggedProduct);
    setProducts(updatedProducts);

    // Update database immediately
    try {
      // Update all products with their new display_order based on current array position
      const updatePromises = updatedProducts.map((product, index) => 
        pb.collection('products').update(product.id, {
          display_order: updatedProducts.length - index  // Higher number = first position
        })
      );
      
      await Promise.all(updatePromises);
      
    } catch (error) {
      console.error('Error updating product order:', error);
      toast({
        title: "Error", 
        description: "Failed to update product order",
        variant: "destructive",
      });
      // Revert local changes on error
      await fetchProducts();
    }
  };

  // Toggle product visibility (hide/show)
  const toggleProductVisibility = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const isHidden = product.hidden || false;
    const action = isHidden ? 'show' : 'hide';
    const confirmMsg = isHidden 
      ? `Show "${product.name}" in store for customers?`
      : `Hide "${product.name}" from store? Customers won't see it.`;
    
    if (!confirm(confirmMsg)) return;
    
    try {
      await pb.collection('products').update(productId, {
        hidden: !isHidden
      });
      
      await fetchProducts();
      
      toast({
        title: "Success",
        description: `Product ${action === 'hide' ? 'hidden from' : 'shown in'} store`,
      });
    } catch (error) {
      console.error(`Error ${action}ing product:`, error);
      toast({
        title: "Error",
        description: `Failed to ${action} product. Please try again.`,
        variant: "destructive",
      });
    }
  };


  useEffect(() => {
    fetchProducts();

    // Subscribe to real-time changes
    const unsubscribe = pb.collection('products').subscribe('*', function (e) {
      console.log('Real-time product update:', e.action, e.record);
      console.log('Product stock in real-time:', e.record.stock);
      console.log('Product in_stock in real-time:', e.record.in_stock);
      
      // Always refresh the list on any change
      if (e.action === 'delete' || e.action === 'update' || e.action === 'create') {
        console.log('Refreshing product list due to:', e.action);
        fetchProducts(); // Refresh entire list
        return;
      }
      
      try {
        const processedRecord = { ...e.record } as Product;
        
        // Ensure stock is a proper number in real-time updates
        if (processedRecord.stock !== undefined && processedRecord.stock !== null) {
          processedRecord.stock = Number(processedRecord.stock);
          if (isNaN(processedRecord.stock)) {
            console.warn('Invalid stock value in real-time update:', processedRecord.name, processedRecord.stock);
            processedRecord.stock = 0;
          }
        }
        
        // Parse preparation data if it's a string
        if (processedRecord.preparation && typeof processedRecord.preparation === 'string') {
          try {
            processedRecord.preparation = JSON.parse(processedRecord.preparation);
          } catch (parseError) {
            console.warn('Could not parse preparation data:', parseError);
            processedRecord.preparation = undefined;
          }
        }
        
        if (e.action === 'create') {
          // Add new product to the list
          setProducts(prev => [processedRecord, ...prev]);
        } else if (e.action === 'update') {
          // Update existing product
          setProducts(prev => {
            const exists = prev.find(p => p.id === e.record.id);
            if (exists) {
              return prev.map(product => 
                product.id === e.record.id ? processedRecord : product
              );
            } else {
              return [processedRecord, ...prev];
            }
          });
        } else if (e.action === 'delete') {
          // Remove deleted product
          setProducts(prev => prev.filter(product => product.id !== e.record.id));
        }
      } catch (error) {
        console.error('Error processing real-time update:', error);
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe?.then(unsub => unsub?.());
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Products Management</h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Products Management</h1>
            <p className="text-gray-600">Add, edit, and manage your products. Drag to reorder.</p>
          </div>
          <Button 
            className="flex items-center gap-2"
            onClick={() => navigate('/admin/products/new')}
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Button>
        </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No products yet</h3>
            <p className="text-gray-600 mb-6 text-center max-w-md">
              Start by adding your first product to your store. You can add product details, images, and set pricing.
            </p>
            <Button 
              className="flex items-center gap-2"
              onClick={() => navigate('/admin/products/new')}
            >
              <Plus className="h-4 w-4" />
              Add Your First Product
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((product, index) => (
              <SimpleDragCard
                key={product.id}
                product={product}
                index={index}
                onEdit={editProduct}
                onToggleVisibility={toggleProductVisibility}
                moveProduct={moveProduct}
              />
            ))}
          </div>
        </div>
      )}

      </div>
    </DndProvider>
  );
};

export default ProductsManagement;