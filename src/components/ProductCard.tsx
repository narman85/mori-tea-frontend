import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { pb } from '@/integrations/supabase/client';
import { getImageUrl } from '@/utils/image-converter';

export interface Product {
  id: string;
  name: string;
  description: string;
  short_description?: string;
  price: number;
  sale_price?: number;
  originalPrice?: number;
  weight: string;
  images?: string[];
  image?: string[]; // PocketBase field
  hover_image?: string; // PocketBase field
  stock?: number; // PocketBase stock field
  quantity?: number;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
  onCartOpen?: () => void;
  className?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  onAddToCart, 
  onCartOpen,
  className = '' 
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { addToCart, updateQuantity, cart } = useCart();
  const navigate = useNavigate();

  // Get current quantity in cart
  const cartItem = cart.find(item => item.id === product.id);
  const quantity = cartItem?.quantity || 0;

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  const handleAddToCart = async () => {
    // Check stock availability
    if (product.stock !== undefined && product.stock !== null) {
      const currentInCart = cartItem?.quantity || 0;
      if (product.stock <= 0) {
        toast.error("Out of Stock", {
          description: "This product is currently out of stock"
        });
        return;
      }
      if (currentInCart >= product.stock) {
        toast.error("Stock Limit Reached", {
          description: `Only ${product.stock} items available in stock`
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));
      addToCart(product);
      
      // Automatically open cart sidebar after adding item
      setTimeout(() => {
        onCartOpen?.();
      }, 600); // Small delay to show the toast first
      
      toast.success(`${product.name} added`, {
        description: "Opening cart...",
        duration: 2000,
        position: "bottom-left"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasDiscount = product.sale_price && product.sale_price > 0 && product.sale_price < product.price;
  
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
  
  
  // Get product images with proper URLs
  const getMainImage = () => {
    // First check PocketBase image field (our uploaded images)
    if (product.image && product.image.length > 0) {
      const firstImage = product.image[0];
      
      // If it's Imgur URL or other external URL, return directly
      if (firstImage.startsWith('http')) {
        return firstImage;
      }
      
      // If it's base64, return directly
      if (firstImage.startsWith('data:')) {
        return firstImage;
      }
      
      // Otherwise it's a PocketBase filename - build proper URL
      try {
        // Create proper record object for pb.files.getURL
        const record = {
          id: product.id,
          collectionId: 'az4zftchp7yppc0', // products collection ID
          collectionName: 'products',
          // Add any other necessary fields
          image: product.image
        };
        
        // Use PocketBase built-in method to generate correct URL
        const imageUrl = pb.files.getURL(record, firstImage);
        console.log('🖼️ Main image URL generated via pb.files.getURL:', imageUrl);
        return imageUrl;
      } catch (error) {
        console.error('ProductCard - Error generating image URL with pb.files.getURL:', error);
        
        // Fallback to manual URL construction
        try {
          const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          const baseUrl = isProd 
            ? 'https://mori-tea.pockethost.io' 
            : (import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');
          
          const fallbackUrl = `${baseUrl}/api/files/az4zftchp7yppc0/${product.id}/${firstImage}`;
          console.log('🖼️ Main image fallback URL:', fallbackUrl);
          return fallbackUrl;
        } catch (fallbackError) {
          console.error('ProductCard - Fallback URL generation failed:', fallbackError);
        }
      }
    }
    
    // Fallback to images array if no PocketBase image
    if (product.images && product.images.length > 0) {
      return getImageUrl(product.images[0]);
    }
    
    // Default fallback
    return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center';
  };

  const getHoverImage = () => {
    // First check if we have a dedicated hover_image field
    if (product.hover_image) {
      // If it's Imgur URL or other external URL, return directly
      if (product.hover_image.startsWith('http')) {
        return product.hover_image;
      }
      
      // If it's base64, return directly
      if (product.hover_image.startsWith('data:')) {
        return product.hover_image;
      }
      
      // Otherwise it's a PocketBase filename - build proper URL
      try {
        // Create proper record object for pb.files.getURL
        const record = {
          id: product.id,
          collectionId: 'az4zftchp7yppc0', // products collection ID
          collectionName: 'products',
          hover_image: product.hover_image
        };
        
        // Use PocketBase built-in method to generate correct URL
        const imageUrl = pb.files.getURL(record, product.hover_image);
        console.log('🖼️ Hover image URL generated via pb.files.getURL:', imageUrl);
        return imageUrl;
      } catch (error) {
        console.error('ProductCard - Error generating hover image URL with pb.files.getURL:', error);
        
        // Fallback to manual URL construction
        try {
          const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          const baseUrl = isProd 
            ? 'https://mori-tea.pockethost.io' 
            : (import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');
          
          const fallbackUrl = `${baseUrl}/api/files/az4zftchp7yppc0/${product.id}/${product.hover_image}`;
          console.log('🖼️ Hover image fallback URL:', fallbackUrl);
          return fallbackUrl;
        } catch (fallbackError) {
          console.error('ProductCard - Fallback hover URL generation failed:', fallbackError);
        }
      }
    }
    
    // Check if we have multiple images in the image array to use second as hover
    if (product.image && product.image.length > 1) {
      const secondImage = product.image[1];
      
      // If it's Imgur URL or other external URL, return directly
      if (secondImage.startsWith('http')) {
        return secondImage;
      }
      
      // If it's base64, return directly
      if (secondImage.startsWith('data:')) {
        return secondImage;
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
        const imageUrl = pb.files.getURL(record, secondImage);
        console.log('🖼️ Second image URL generated via pb.files.getURL:', imageUrl);
        return imageUrl;
      } catch (error) {
        console.error('ProductCard - Error generating second image URL with pb.files.getURL:', error);
        
        // Fallback to manual URL construction
        try {
          const isProd = window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1';
          const baseUrl = isProd 
            ? 'https://mori-tea.pockethost.io' 
            : (import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090');
          
          const fallbackUrl = `${baseUrl}/api/files/az4zftchp7yppc0/${product.id}/${secondImage}`;
          console.log('🖼️ Second image fallback URL:', fallbackUrl);
          return fallbackUrl;
        } catch (fallbackError) {
          console.error('ProductCard - Fallback second image URL generation failed:', fallbackError);
        }
      }
    }
    
    // Fallback to images array if available
    if (product.images && product.images.length > 1) {
      return getImageUrl(product.images[1]);
    }
    
    // Return the same main image for hover if no separate hover image
    // This prevents the hover effect from showing if there's no second image
    return null;
  };

  const mainImageUrl = getMainImage();
  const hoverImageUrl = getHoverImage();

  return (
    <article 
      className={`flex flex-col h-full bg-white shadow-sm hover:shadow-lg transition-all duration-300 group cursor-pointer ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleCardClick}
    >
      {/* Product Image */}
      <div className="w-full flex-shrink-0 relative overflow-hidden">
        {/* Main image */}
        <img
          src={mainImageUrl}
          alt={product.name}
          className={`aspect-[1.06] object-cover w-full transition-opacity duration-[1500ms] ease-in-out ${
            isHovered && hoverImageUrl ? 'opacity-0' : 'opacity-100'
          }`}
        />
        
        {/* Hover image - only show if we have a dedicated hover image */}
        {hoverImageUrl && (
          <img
            src={hoverImageUrl}
            alt={`${product.name} hover`}
            className={`aspect-[1.06] object-cover w-full absolute inset-0 transition-opacity duration-[1500ms] ease-in-out ${
              isHovered ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}
      </div>
      
      {/* Product Info - takes remaining space */}
      <div className="bg-[rgba(238,238,238,1)] flex flex-col justify-between p-4 sm:p-6 flex-grow">
        <div className="flex flex-col gap-4">
          {/* Product Name and Price on same line */}
          <div className="flex items-start justify-between">
            <h3 className="text-black font-medium text-base leading-tight flex-1 min-w-0 pr-2">
              {product.name}
            </h3>
            <div className="flex flex-col items-end text-right flex-shrink-0">
              {hasDiscount && (
                <div 
                  className="text-black leading-none whitespace-nowrap text-sm"
                  style={{
                    textDecoration: 'line-through',
                    textDecorationColor: 'red',
                    textDecorationThickness: '2px'
                  }}
                >
                  {product.price} EUR
                </div>
              )}
              <div className={`text-black leading-none whitespace-nowrap font-medium text-base ${hasDiscount ? 'mt-1' : ''}`}>
                {hasDiscount ? product.sale_price : product.price} EUR
              </div>
            </div>
          </div>
          
          {/* Description and Weight */}
          <div className="flex flex-col gap-2">
            <p className="text-[rgba(80,80,80,1)] text-sm sm:text-base leading-relaxed">
              {product.short_description || product.description}
            </p>
            <div className="text-[rgba(173,29,24,1)] text-sm">
              {formatWeight(product.weight)}
            </div>
          </div>
        </div>
      </div>
      
      {/* Add to Cart Button - always at bottom */}
      {quantity === 0 ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleAddToCart();
          }}
          disabled={isLoading || (product.stock !== undefined && product.stock <= 0)}
          className="bg-[rgba(226,226,226,1)] flex w-full items-center justify-center gap-2 text-base text-black font-normal p-4 sm:p-6 border-[rgba(209,209,209,1)] border-t hover:bg-[rgba(216,216,216,1)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <span>
            {isLoading 
              ? 'Adding...' 
              : (product.stock !== undefined && product.stock <= 0)
                ? 'Out of Stock'
                : 'Add to cart'
            }
          </span>
        </button>
      ) : (
        <div className="bg-[rgba(226,226,226,1)] flex w-full items-center justify-between gap-2 text-base text-black font-normal p-4 sm:p-6 border-[rgba(209,209,209,1)] border-t flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateQuantity(product.id, quantity - 1);
            }}
            className="flex items-center justify-center w-8 h-8 hover:bg-[rgba(216,216,216,1)] rounded-full transition-colors"
          >
            -
          </button>
          <span className="flex-1 text-center">
            In cart ({quantity})
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Check stock limit before incrementing
              if (product.stock !== undefined && quantity >= product.stock) {
                toast.error("Stock Limit Reached", {
                  description: `Only ${product.stock} items available in stock`
                });
                return;
              }
              updateQuantity(product.id, quantity + 1);
            }}
            disabled={product.stock !== undefined && quantity >= product.stock}
            className="flex items-center justify-center w-8 h-8 hover:bg-[rgba(216,216,216,1)] rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>
      )}
    </article>
  );
};
