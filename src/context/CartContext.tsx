import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Product } from '@/components/ProductCard';
import { pb } from '@/integrations/supabase/client';

interface CartItem extends Product {
  quantity: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  updateProductInCart: (updatedProduct: Product) => void;
  clearCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

interface CartProviderProps {
  children: ReactNode;
}

export const CartProvider: React.FC<CartProviderProps> = ({ children }) => {
  const [cart, setCart] = useState<CartItem[]>([]);

  const updateProductInCart = (updatedProduct: Product) => {
    setCart(prevCart => 
      prevCart.map(item => {
        if (item.id === updatedProduct.id) {
          // Keep the quantity, but update other product details (especially price)
          console.log(`🔄 Updating ${item.name} in cart: ${item.price} → ${updatedProduct.price}`);
          return { ...updatedProduct, quantity: item.quantity };
        }
        return item;
      })
    );
  };

  // Subscribe to product updates for real-time price changes
  useEffect(() => {
    const unsubscribe = pb.collection('products').subscribe('*', function (e) {
      if (e.action === 'update' && e.record) {
        console.log('Real-time product update in Cart:', e.record.name, 'new price:', e.record.price);
        
        // Transform PocketBase record to Product format
        const updatedProduct: Product = {
          id: e.record.id,
          name: e.record.name,
          description: e.record.description,
          short_description: e.record.short_description,
          price: Number(e.record.price) || 0,
          sale_price: e.record.sale_price ? Number(e.record.sale_price) : undefined,
          stock: e.record.stock !== undefined ? Number(e.record.stock) : undefined,
          weight: e.record.category || '100g',
          images: e.record.image && e.record.image.length > 0
            ? e.record.image.map((img: string) => {
                try {
                  return pb.files.getURL(e.record, img);
                } catch (error) {
                  return 'https://via.placeholder.com/400x400?text=Error';
                }
              })
            : ['https://via.placeholder.com/400x400?text=No+Image'],
          image: e.record.image,
          hover_image: e.record.hover_image,
          originalPrice: undefined
        };

        // Update product in cart if it exists
        updateProductInCart(updatedProduct);
      }
    });

    return () => {
      unsubscribe?.then(unsub => unsub?.());
    };
  }, []); // Remove cart dependency

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.id === product.id);
      if (existingItem) {
        // Check stock limit before adding
        if (product.stock !== undefined && existingItem.quantity >= product.stock) {
          console.warn(`Cannot add more ${product.name} - stock limit reached (${product.stock})`);
          return prevCart; // Don't add more
        }
        return prevCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      // Check stock for new item
      if (product.stock !== undefined && product.stock <= 0) {
        console.warn(`Cannot add ${product.name} - out of stock`);
        return prevCart; // Don't add
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prevCart =>
      prevCart.map(item => {
        if (item.id === productId) {
          // Check stock limit before updating quantity
          if (item.stock !== undefined && quantity > item.stock) {
            console.warn(`Cannot set quantity to ${quantity} for ${item.name} - stock limit is ${item.stock}`);
            return { ...item, quantity: item.stock }; // Cap at stock limit
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cart.reduce((total, item) => {
      const effectivePrice = (item.sale_price && item.sale_price > 0 && item.sale_price < item.price) 
        ? item.sale_price 
        : item.price;
      return total + (effectivePrice * item.quantity);
    }, 0);
  };

  const getItemQuantity = (productId: string) => {
    const item = cart.find(item => item.id === productId);
    return item ? item.quantity : 0;
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateQuantity,
      updateProductInCart,
      clearCart,
      getTotalItems,
      getTotalPrice,
      getItemQuantity
    }}>
      {children}
    </CartContext.Provider>
  );
};