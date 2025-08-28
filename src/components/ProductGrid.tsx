import React, { useState, useEffect } from 'react';
import { ProductCard, Product } from './ProductCard';
import { CartSidebar } from './CartSidebar';
import { pb } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductGridProps {
  className?: string;
}

interface PocketBaseProduct {
  id: string;
  name: string;
  description: string;
  short_description?: string;
  price: number;
  category: string;
  in_stock: boolean;
  stock?: number;
  image: string[];
  hover_image?: string;
  created: string;
  updated: string;
  display_order?: number;
  hidden?: boolean;
}

export const ProductGrid: React.FC<ProductGridProps> = ({ className = '' }) => {
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();

    // Subscribe to real-time changes
    const unsubscribe = pb.collection('products').subscribe('*', function (e) {
      console.log('Real-time product update in ProductGrid:', e.action, e.record);
      
      // Transform the record to match our Product interface
      const transformRecord = (record: PocketBaseProduct): Product => {
        // Ensure stock is a proper number
        let stock = record.stock;
        if (stock !== undefined && stock !== null) {
          stock = Number(stock);
          if (isNaN(stock)) {
            console.warn('Invalid stock value in ProductGrid real-time:', record.name, stock);
            stock = 0;
          }
        }
        
        return {
          id: record.id,
          name: record.name,
          description: record.description,
          short_description: record.short_description,
          price: record.price,
          sale_price: record.sale_price === 0 ? undefined : record.sale_price,
          stock: stock,
          weight: record.category || '100g',
          images: [], // We don't use this field anymore for display
          image: record.image, // Pass raw PocketBase image array
          hover_image: record.hover_image, // Pass raw PocketBase hover image
          originalPrice: undefined
        };
      };
      
      if (e.action === 'create') {
        // Add new product if it's in stock and not hidden
        if (e.record.in_stock && !e.record.hidden) {
          const transformedProduct = transformRecord(e.record as PocketBaseProduct);
          setProducts(prev => [transformedProduct, ...prev]);
        }
      } else if (e.action === 'update') {
        // Update existing product
        const transformedProduct = transformRecord(e.record as PocketBaseProduct);
        setProducts(prev => {
          if (e.record.in_stock && !e.record.hidden) {
            // Product is in stock and not hidden, update or add it
            const exists = prev.find(p => p.id === e.record.id);
            if (exists) {
              return prev.map(product => 
                product.id === e.record.id ? transformedProduct : product
              );
            } else {
              return [transformedProduct, ...prev];
            }
          } else {
            // Product is out of stock or hidden, remove it from the grid
            return prev.filter(product => product.id !== e.record.id);
          }
        });
      } else if (e.action === 'delete') {
        // Remove deleted product
        setProducts(prev => prev.filter(product => product.id !== e.record.id));
      }
    });

    // Cleanup subscription on unmount
    return () => {
      unsubscribe?.then(unsub => unsub?.());
    };
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const records = await pb.collection('products').getFullList<PocketBaseProduct>({
        sort: '-display_order,-created',
        filter: 'hidden != true' // Only show products that are not hidden
      });

      // Transform PocketBase products to match our Product interface
      const transformedProducts: Product[] = records.map(record => {
        // Ensure stock is a proper number
        let stock = record.stock;
        if (stock !== undefined && stock !== null) {
          stock = Number(stock);
          if (isNaN(stock)) {
            console.warn('Invalid stock value for product in ProductGrid:', record.name, stock);
            stock = 0;
          }
        }
        
        const transformedProduct = {
          id: record.id,
          name: record.name,
          description: record.description,
          short_description: record.short_description,
          price: record.price,
          sale_price: record.sale_price === 0 ? undefined : record.sale_price,
          weight: record.category || '100g', // Use category as weight for now
          stock: stock, // Ensure stock is a number
          images: [], // We don't use this field anymore for display
          image: record.image, // Pass raw PocketBase image array
          hover_image: record.hover_image, // Pass raw PocketBase hover image
          originalPrice: undefined // Remove featured discount
        };
        
        return transformedProduct;
      });

      console.log('ProductGrid - Setting real products from DB:', transformedProducts.map(p => ({
        name: p.name,
        price: p.price,
        sale_price: p.sale_price
      })));
      
      setProducts(transformedProducts);
    } catch (error) {
      console.error('Error fetching products:', error);
      console.error('Filter used:', 'hidden != true');
      
      // If the error is due to missing hidden field, try without filter
      try {
        console.log('Trying to fetch without hidden filter...');
        const recordsWithoutFilter = await pb.collection('products').getFullList<PocketBaseProduct>({
          sort: '-display_order,-created'
        });
        console.log('Products fetched without filter:', recordsWithoutFilter.length);
        
        // Filter out hidden products manually
        const visibleProducts = recordsWithoutFilter.filter(record => !record.hidden);
        console.log('Visible products after manual filter:', visibleProducts.length);
        
        // Transform visible products
        const transformedProducts: Product[] = visibleProducts.map(record => {
          let stock = record.stock;
          if (stock !== undefined && stock !== null) {
            stock = Number(stock);
            if (isNaN(stock)) {
              console.warn('Invalid stock value for product in ProductGrid:', record.name, stock);
              stock = 0;
            }
          }
          
          return {
            id: record.id,
            name: record.name,
            description: record.description,
            short_description: record.short_description,
            price: record.price,
            sale_price: record.sale_price,
            weight: record.category || '100g',
            stock: stock,
            images: [], // We don't use this field anymore for display
            image: record.image, // Pass raw PocketBase image array
            hover_image: record.hover_image, // Pass raw PocketBase hover image
            originalPrice: undefined
          };
        });
        
        console.log('ProductGrid - Setting products from fallback manual filter:', transformedProducts.map(p => ({
          name: p.name,
          price: p.price,
          sale_price: p.sale_price
        })));
        
        setProducts(transformedProducts);
        return; // Exit early if successful
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
      
      // No fallback products - show empty state
      console.log('ProductGrid - No products available, showing empty state');
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };


  return (
    <section className={`px-8 max-md:px-4 ${className}`}>
      <h2 className="text-black text-5xl font-normal leading-none text-center mt-[30px] max-md:text-[36px] max-md:mt-6">
        Selection
      </h2>
      
      <div className="flex justify-center w-full">
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5 w-full max-w-[1428px] mt-[35px] max-md:mt-8">
          {loading ? (
            // Loading skeletons
            Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="w-full">
                <Skeleton className="aspect-square w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4 mt-3" />
                <Skeleton className="h-4 w-1/2 mt-2" />
                <Skeleton className="h-6 w-1/3 mt-3" />
              </div>
            ))
          ) : products.length === 0 ? (
            // No products message
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 text-lg">No products available</p>
              <p className="text-gray-400 text-sm mt-2">Please check back later</p>
            </div>
          ) : (
            // Products grid
            products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={() => {}} // Bu artıq istifadə olunmur
                onCartOpen={() => setIsCartOpen(true)}
                className="w-full"
              />
            ))
          )}
        </div>
      </div>
      
      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] flex justify-start mt-[205px] max-md:mt-10 max-md:w-[70vw] max-md:relative max-md:left-0 max-md:right-auto max-md:-ml-4 max-md:mr-0">
        <img
          src="https://api.builder.io/api/v1/image/assets/TEMP/f9a083c8737fcdd71aaa82d2560e2547c2c34744?placeholderIfAbsent=true"
          alt="Tea ceremony decoration"
          className="aspect-[3.53] object-contain w-[965px] max-w-full max-md:w-full md:w-[420px] lg:w-[965px] md:self-start"
        />
      </div>

      {/* Cart Sidebar */}
      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />
    </section>
  );
};
