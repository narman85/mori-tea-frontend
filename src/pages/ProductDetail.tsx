import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Minus } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';
import { CartSidebar } from '@/components/CartSidebar';
import { toast } from 'sonner';
import ProductImageGallery from '@/components/ProductImageGallery';
import TeaPreparationGuide from '@/components/TeaPreparationGuide';
import { pb } from '@/integrations/supabase/client';

interface DetailProduct {
  id: string;
  name: string;
  description: string;
  short_description?: string;
  price: number;
  sale_price?: number;
  image?: string[];
  hover_image?: string;
  weight?: string;
  category?: string;
  stock?: number;
  created: string;
  updated: string;
  hidden?: boolean;
  preparation?: {
    amount: string;
    temperature: string;
    steepTime: string;
    taste: string;
  };
}


const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, removeFromCart, getItemQuantity, updateQuantity } = useCart();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [product, setProduct] = useState<DetailProduct | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch product from PocketBase
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const record = await pb.collection('products').getOne<DetailProduct>(id);
        
        // Parse preparation data if it's a string
        if (record.preparation && typeof record.preparation === 'string') {
          try {
            record.preparation = JSON.parse(record.preparation);
          } catch (parseError) {
            console.warn('Could not parse preparation data:', parseError);
            record.preparation = undefined;
          }
        }
        
        // Handle sale_price: convert 0 to undefined
        if (record.sale_price === 0) {
          record.sale_price = undefined;
        }
        
        // Check if product is hidden - if so, treat as not found
        if (record.hidden) {
          setProduct(null);
        } else {
          setProduct(record);
        }
      } catch (error) {
        console.error('Error fetching product:', error);
        toast.error('Failed to load product');
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="bg-white flex flex-col overflow-hidden items-center">
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600">Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="bg-white flex flex-col overflow-hidden items-center">
        <Header />
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Product not found</h1>
            <Button onClick={() => navigate('/')}>Back to Home</Button>
          </div>
        </div>
      </div>
    );
  }

  // Format weight with 'g' if it's just a number
  const formatWeight = (weight: string) => {
    if (!weight) return '';
    
    // Check if it's just a number (no letters)
    const isOnlyNumber = /^\d+$/.test(weight.trim());
    
    if (isOnlyNumber) {
      return `${weight}g`;
    }
    
    return weight;
  };

  // Debug discount logic
  const hasDiscount = product.sale_price && product.sale_price > 0 && product.sale_price < product.price;
  if (product.sale_price !== undefined) {
    console.log(`Product "${product.name}" discount debug:`, {
      price: product.price,
      sale_price: product.sale_price,
      hasDiscount: hasDiscount
    });
  }

  const handleAddToCart = () => {
    // Check stock availability
    if (product.stock !== undefined && product.stock !== null) {
      const currentInCart = getItemQuantity(product.id);
      if (product.stock <= 0) {
        toast.error("Out of Stock", {
          description: "This product is currently out of stock",
          position: "bottom-left"
        });
        return;
      }
      if (currentInCart >= product.stock) {
        toast.error("Stock Limit Reached", {
          description: `Only ${product.stock} items available in stock`,
          position: "bottom-left"
        });
        return;
      }
    }

    // Convert DetailProduct to Product format for cart
    const cartProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      sale_price: product.sale_price, // Include sale_price for cart discount
      weight: product.weight || '',
      stock: product.stock,
      images: productImages, // Use the same images we show in the gallery
      image: product.image, // Raw image array for ProductCard compatibility
      hover_image: product.hover_image
    };
    
    console.log('Adding to cart:', cartProduct);
    addToCart(cartProduct);
    
    // Automatically open cart sidebar after adding item
    setTimeout(() => {
      setIsCartOpen(true);
    }, 600); // Small delay to show the toast first
    
    toast.success(`${product.name} added`, {
      description: "Opening cart...",
      duration: 2000,
      position: "bottom-left"
    });
  };

  const handleIncrement = () => {
    // Check stock limit before incrementing
    if (product.stock !== undefined && product.stock !== null) {
      const currentInCart = getItemQuantity(product.id);
      if (currentInCart >= product.stock) {
        toast.error("Stock Limit Reached", {
          description: `Only ${product.stock} items available in stock`,
          position: "bottom-left"
        });
        return;
      }
    }

    // Convert DetailProduct to Product format for cart
    const cartProduct = {
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price,
      weight: product.weight || '',
      stock: product.stock,
      images: productImages, // Use the same images we show in the gallery
      image: product.image, // Raw image array for ProductCard compatibility
      hover_image: product.hover_image
    };
    
    addToCart(cartProduct);
    toast.success(`${product.name} quantity increased`, {
      position: "bottom-left",
      duration: 2000
    });
  };

  const handleDecrement = () => {
    const currentQuantity = getItemQuantity(product.id);
    if (currentQuantity > 1) {
      updateQuantity(product.id, currentQuantity - 1);
    } else {
      removeFromCart(product.id);
    }
    toast.success(`${product.name} quantity decreased`, {
      position: "bottom-left",
      duration: 2000
    });
  };

  // Get product images with proper URLs
  const getProductImages = () => {
    if (!product.image || product.image.length === 0) {
      // No images available, return fallback
      return ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop'];
    }

    return product.image.map(img => {
      // If it's already a full URL (Imgur, etc.), return directly
      if (img.startsWith('http')) {
        return img;
      }
      
      // If it's base64, return directly
      if (img.startsWith('data:')) {
        return img;
      }
      
      // Otherwise it's a PocketBase filename - build proper URL
      try {
        // Create proper record object for pb.files.getURL
        const record = {
          id: product.id,
          collectionId: 'az4zftchp7yppc0', // products collection ID
          collectionName: 'products',
          image: product.image
        };
        
        // Use PocketBase built-in method to generate correct URL
        const imageUrl = pb.files.getURL(record, img);
        console.log('🖼️ ProductDetail image URL generated via pb.files.getURL:', imageUrl);
        return imageUrl;
      } catch (error) {
        console.error('ProductDetail - Error generating image URL with pb.files.getURL:', error);
        
        // Fallback to manual URL construction
        try {
          const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          const baseUrl = isProd 
            ? 'https://mori-tea.pockethost.io' 
            : (import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');
          
          const fallbackUrl = `${baseUrl}/api/files/az4zftchp7yppc0/${product.id}/${img}`;
          console.log('🖼️ ProductDetail image fallback URL:', fallbackUrl);
          return fallbackUrl;
        } catch (fallbackError) {
          console.error('ProductDetail - Fallback URL generation failed:', fallbackError);
          return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&h=800&fit=crop';
        }
      }
    });
  };
  
  const productImages = getProductImages();

  return (
    <div className="bg-white flex flex-col overflow-hidden items-center">
      <Header />
      
      <main className="w-full flex flex-col items-center">
        {/* Back button */}
        <div className="w-full max-w-7xl px-4 py-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="mb-6 gap-2 text-black hover:bg-[rgba(238,238,238,1)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          {/* Product detail content */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Left side - Product image gallery */}
            <div className="flex justify-center lg:justify-start">
              <div className="w-full max-w-md lg:max-w-none">
                {productImages.length > 0 ? (
                  <ProductImageGallery 
                    images={productImages} 
                    productName={product.name}
                  />
                ) : (
                  <div className="aspect-square bg-gray-100 flex items-center justify-center rounded-lg">
                    <span className="text-gray-400">No image available</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right side - Product info */}
            <div className="flex flex-col justify-center space-y-6 p-6 lg:p-8">
              {/* Product name */}
              <h1 className="text-2xl lg:text-3xl font-medium text-black leading-tight">
                {product.name}
              </h1>

              {/* Product description */}
              <div className="space-y-4">
                <p className="text-[rgba(80,80,80,1)] leading-relaxed text-sm lg:text-base">
                  {product.description}
                </p>
              </div>

              {/* Product Details */}
              <div className="flex flex-col gap-4">
                {/* Weight and Price on same line */}
                <div className="flex items-center justify-between">
                  {/* Weight */}
                  {product.category && (
                    <div className="flex items-center gap-2">
                      <span className="text-black font-medium">Weight:</span>
                      <span className="text-[rgba(173,29,24,1)] font-medium">{formatWeight(product.category)}</span>
                    </div>
                  )}
                  
                  {/* Price */}
                  <div className="flex items-center gap-2">
                    <span className="text-black font-medium">Price:</span>
                    <div className="flex items-center gap-3">
                      {/* Show original price with red strikethrough if there's a discount */}
                      {product.sale_price && product.sale_price > 0 && product.sale_price < product.price && (
                        <span 
                          className="text-xl lg:text-2xl font-medium text-black relative"
                          style={{
                            textDecoration: 'line-through',
                            textDecorationColor: 'red',
                            textDecorationThickness: '2px'
                          }}
                        >
                          €{product.price.toFixed(2)}
                        </span>
                      )}
                      {/* Show sale price if discount exists, otherwise show regular price */}
                      <span className="text-xl lg:text-2xl font-medium text-black">
                        €{(product.sale_price && product.sale_price > 0 && product.sale_price < product.price) 
                          ? product.sale_price.toFixed(2) 
                          : product.price.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Buy button */}
              <div className="pt-4">
                {product.stock === 0 ? (
                  <div className="w-full bg-gray-200 border border-gray-300 flex items-center justify-center p-4 lg:p-6">
                    <span className="text-base font-normal text-gray-500">
                      Out of Stock
                    </span>
                  </div>
                ) : getItemQuantity(product.id) > 0 ? (
                  <div className="w-full bg-[rgba(226,226,226,1)] border-[rgba(209,209,209,1)] border flex items-center justify-between p-4 lg:p-6">
                    <button
                      onClick={handleDecrement}
                      className="flex items-center justify-center w-8 h-8 hover:bg-[rgba(216,216,216,1)] rounded transition-colors"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="text-base font-normal text-black">
                      In cart ({getItemQuantity(product.id)})
                    </span>
                    <button
                      onClick={handleIncrement}
                      className="flex items-center justify-center w-8 h-8 hover:bg-[rgba(216,216,216,1)] rounded transition-colors"
                      disabled={product.stock !== undefined && getItemQuantity(product.id) >= product.stock}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleAddToCart}
                    className="bg-[rgba(226,226,226,1)] w-full flex items-center justify-center gap-2 text-base text-black font-normal p-4 lg:p-6 border-[rgba(209,209,209,1)] border hover:bg-[rgba(216,216,216,1)] transition-colors"
                  >
                    Add to Cart
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tea Preparation Guide */}
          {product.preparation && (
            <TeaPreparationGuide 
              preparation={product.preparation}
              productName={product.name}
            />
          )}

        </div>
      </main>

      {/* Cart Sidebar */}
      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />
    </div>
  );
};

export default ProductDetail;