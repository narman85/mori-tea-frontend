import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { pb } from '@/integrations/supabase/client';
import { ArrowLeft, MapPin } from 'lucide-react';
import { StripePaymentForm } from '@/components/StripePaymentForm';
import { createMockPaymentIntent, createStripePaymentIntent } from '@/utils/stripe-api';
import { generateOAuthUserId, isOAuthUserId, isOAuthUser } from '@/utils/oauth-helpers';
import { sendOrderConfirmationEmailJS } from '@/utils/email-service';

interface ShippingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
}

export const Checkout: React.FC = () => {
  const { cart, getTotalPrice, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [currentStep, setCurrentStep] = useState<'shipping' | 'payment'>('shipping');

  const [shippingInfo, setShippingInfo] = useState<ShippingInfo>({
    firstName: '',
    lastName: '',
    email: user?.email || '',
    phone: '',
    address: '',
    city: '',
    postalCode: '',
    country: 'Azerbaijan'
  });

  // Redirect if cart is empty
  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Your cart is empty</h1>
          <Button onClick={() => navigate('/')}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  const handleInputChange = (field: keyof ShippingInfo, value: string) => {
    setShippingInfo(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Create order directly (demo mode)
  const handleOrderCreation = async () => {
    try {
      setLoading(true);
      
      // Create order in PocketBase
      const subtotal = getTotalPrice();
      const shipping = subtotal > 50 ? 0 : 5;
      const total = subtotal + shipping;

      // Handle OAuth users - don't use user ID for orders if OAuth
      let actualUserId = null;
      let isOAuthUserFlag = false;
      const oauthUserId = null;
      
      const userIsOAuth = isOAuthUser(user);
      console.log('🔍 Checkout: Current user info:', {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        username: user?.username,
        isOAuth: userIsOAuth,
        oldMethod: user?.id ? isOAuthUserId(user.id) : false
      });
      
      if (user?.id) {
        if (userIsOAuth) {
          // OAuth users - check if they exist in PocketBase, if not treat as guest
          console.log('🔍 OAuth user detected, checking if exists in PocketBase...');
          try {
            // Try to verify user exists by making a test API call
            await pb.collection('_pb_users_auth_').getOne(user.id);
            console.log('✅ OAuth user verified in PocketBase, using user ID:', user.id);
            isOAuthUserFlag = true;
            actualUserId = user.id; // Use real user ID for OAuth users
          } catch (userCheckError) {
            console.log('⚠️ OAuth user not found in PocketBase, treating as guest:', userCheckError);
            isOAuthUserFlag = true;
            actualUserId = null; // Treat as guest order
          }
        } else {
          // Regular registered users - use their ID
          actualUserId = user.id;
          console.log('✅ Using regular user ID for order:', actualUserId);
        }
      }

      const orderData = {
        ...(actualUserId ? { user: actualUserId } : {}), // Only use real database ID if found
        total_price: total,
        status: 'pending',
        shipping_address: shippingInfo,
        // For OAuth users, store their info like guest users
        ...(isOAuthUserFlag && {
          guest_email: user.email,
          guest_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
          guest_phone: shippingInfo.phone
          // oauth_user_id: oauthUserId // Will add this field later when PocketBase schema updated
        }),
        // For guest users (no login)
        ...(!user && {
          guest_email: shippingInfo.email,
          guest_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
          guest_phone: shippingInfo.phone
        })
      };

      console.log('Creating order with data:', orderData);
      
      // Create order directly via PocketBase (no authentication required for orders)
      let order;
      try {
        // Try to create order directly
        order = await pb.collection('orders').create(orderData);
      } catch (authError) {
        console.log('⚠️ Auth error creating order, trying without auth:', authError);
        
        // If auth fails, create a temporary admin session for order creation
        try {
          // Use direct API call without authentication
          const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'}/api/collections/orders/records`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
          });
          
          if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`Failed to create order: ${errorData}`);
          }
          
          order = await response.json();
        } catch (directError) {
          console.error('Direct API call also failed:', directError);
          throw new Error('Unable to create order. Please try logging in first.');
        }
      }

      // Create order items
      for (const item of cart) {
        const orderItemData = {
          order: order.id,
          product: item.id,
          quantity: item.quantity,
          price: item.sale_price && item.sale_price > 0 ? item.sale_price : item.price
        };
        
        try {
          // Try to create order item directly
          await pb.collection('order_items').create(orderItemData);
        } catch (authError) {
          console.log('⚠️ Auth error creating order item, trying without auth:', authError);
          
          // If auth fails, use direct API call
          try {
            const response = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'}/api/collections/order_items/records`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(orderItemData)
            });
            
            if (!response.ok) {
              console.error(`Failed to create order item: ${await response.text()}`);
              // Continue with other items even if one fails
            }
          } catch (directError) {
            console.error('Direct API call for order item failed:', directError);
            // Continue with other items even if one fails
          }
        }
      }

      // Update product stock after successful order
      console.log('🔄 Updating product stock...');
      for (const item of cart) {
        try {
          // Get current product data to check current stock
          const currentProduct = await pb.collection('products').getOne(item.id);
          const newStock = Math.max(0, (currentProduct.stock || 0) - item.quantity);
          
          console.log(`📦 Product ${item.name}: ${currentProduct.stock} → ${newStock} (sold ${item.quantity})`);
          
          // Update stock
          await pb.collection('products').update(item.id, {
            stock: newStock,
            in_stock: newStock > 0
          });
          
        } catch (stockError) {
          console.error(`⚠️ Failed to update stock for product ${item.id}:`, stockError);
          
          // Try direct API call if PocketBase auth fails
          try {
            const currentProduct = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'}/api/collections/products/records/${item.id}`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
              }
            });
            
            if (currentProduct.ok) {
              const productData = await currentProduct.json();
              const newStock = Math.max(0, (productData.stock || 0) - item.quantity);
              
              const updateResponse = await fetch(`${import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090'}/api/collections/products/records/${item.id}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  stock: newStock,
                  in_stock: newStock > 0
                })
              });
              
              if (updateResponse.ok) {
                console.log(`✅ Stock updated via API for ${item.name}: ${newStock}`);
              } else {
                console.error(`❌ Failed to update stock via API for ${item.name}`);
              }
            }
          } catch (apiError) {
            console.error(`❌ API stock update failed for ${item.name}:`, apiError);
          }
        }
      }

      // Send order confirmation email
      try {
        const customerEmail = user?.email || shippingInfo.email;
        const customerName = `${shippingInfo.firstName} ${shippingInfo.lastName}`;
        
        const emailData = {
          customerEmail,
          customerName,
          orderId: order.id,
          orderTotal: total,
          orderItems: cart.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.sale_price && item.sale_price > 0 ? item.sale_price : item.price
          })),
          shippingAddress: shippingInfo
        };

        console.log('📧 Sending order confirmation email...');
        const emailSent = await sendOrderConfirmationEmailJS(emailData);
        
        if (emailSent) {
          toast.success('Order placed successfully! Confirmation email sent.');
        } else {
          toast.success('Order placed successfully! (Email notification failed)');
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        toast.success('Order placed successfully! (Email notification failed)');
      }

      // Clear cart and redirect to success page
      clearCart();
      navigate('/order-confirmation', { 
        state: { 
          orderId: order.id,
          orderDetails: {
            ...shippingInfo,
            total: total,
            items: cart
          }
        } 
      });
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error('Failed to create order: ' + (error.message || 'Unknown error'));
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Create payment intent and move to payment step
  const proceedToPayment = async () => {
    try {
      setLoading(true);
      // Clear any existing client secret to avoid reuse
      setClientSecret('');
      
      const total = getTotalPrice() + (getTotalPrice() > 50 ? 0 : 5);
      console.log('Creating real Stripe payment intent for total:', total);
      
      // Create real Stripe payment intent
      const paymentIntent = await createStripePaymentIntent(total);
      console.log('Payment intent created:', paymentIntent);
      
      setClientSecret(paymentIntent.client_secret);
      setCurrentStep('payment');
      
      toast.success('Payment form ready');
    } catch (error) {
      console.error('Error creating payment intent:', error);
      toast.error('Failed to initialize payment: ' + (error?.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const required = ['firstName', 'lastName', 'email', 'phone', 'address', 'city', 'postalCode'];
    for (const field of required) {
      if (!shippingInfo[field as keyof ShippingInfo]) {
        toast.error(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
        return false;
      }
    }
    return true;
  };

  const handleShippingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      await proceedToPayment();
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      setLoading(true);

      // Create order in PocketBase with 'paid' status
      const subtotal = getTotalPrice();
      const shipping = subtotal > 50 ? 0 : 5;
      const total = subtotal + shipping;

      // Handle OAuth users - don't use user ID for orders if OAuth
      let actualUserId = null;
      let isOAuthUserFlag = false;
      const oauthUserId = null;
      
      const userIsOAuth = isOAuthUser(user);
      console.log('🔍 Checkout: Current user info:', {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        username: user?.username,
        isOAuth: userIsOAuth,
        oldMethod: user?.id ? isOAuthUserId(user.id) : false
      });
      
      if (user?.id) {
        if (userIsOAuth) {
          // OAuth users - check if they exist in PocketBase, if not treat as guest
          console.log('🔍 OAuth user detected, checking if exists in PocketBase...');
          try {
            // Try to verify user exists by making a test API call
            await pb.collection('_pb_users_auth_').getOne(user.id);
            console.log('✅ OAuth user verified in PocketBase, using user ID:', user.id);
            isOAuthUserFlag = true;
            actualUserId = user.id; // Use real user ID for OAuth users
          } catch (userCheckError) {
            console.log('⚠️ OAuth user not found in PocketBase, treating as guest:', userCheckError);
            isOAuthUserFlag = true;
            actualUserId = null; // Treat as guest order
          }
        } else {
          // Regular registered users - use their ID
          actualUserId = user.id;
          console.log('✅ Using regular user ID for order:', actualUserId);
        }
      }

      const orderData = {
        ...(actualUserId ? { user: actualUserId } : {}), // Only use real database ID
        total_price: total,
        status: 'paid', // Mark as paid since payment succeeded
        shipping_address: shippingInfo,
        // For OAuth users, store their info like guest users
        ...(isOAuthUserFlag && {
          guest_email: user.email,
          guest_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
          guest_phone: shippingInfo.phone
          // oauth_user_id: oauthUserId // Will add this field later when PocketBase schema updated
        }),
        // For guest users (no login)
        ...(!user && {
          guest_email: shippingInfo.email,
          guest_name: `${shippingInfo.firstName} ${shippingInfo.lastName}`,
          guest_phone: shippingInfo.phone
        })
      };

      console.log('Creating order with data:', orderData);
      
      // For guest users, use public API
      let order;
      if (!user) {
        // Guest order - create without authentication using public API
        try {
          const baseUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
          const response = await fetch(`${baseUrl}/api/collections/orders/records`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderData)
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Guest order creation failed: ${errorData.message || response.statusText}`);
          }
          
          order = await response.json();
          console.log('Guest order created successfully:', order.id);
        } catch (guestOrderError) {
          console.error('Guest order creation failed:', guestOrderError);
          throw new Error('Unable to create guest order. Please try logging in or contact support.');
        }
      } else {
        // Authenticated user order - use normal PocketBase client
        order = await pb.collection('orders').create(orderData);
        console.log('User order created successfully:', order.id);
      }
      
      // Create order items
      const orderItemPromises = cart.map(async (item) => {
        const effectivePrice = (item.sale_price && item.sale_price > 0 && item.sale_price < item.price) 
          ? item.sale_price 
          : item.price;
        
        const orderItemData = {
          order: order.id,
          product: item.id,
          quantity: item.quantity,
          price: effectivePrice
        };

        if (!user) {
          // Guest order item - use public API
          const baseUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
          const response = await fetch(`${baseUrl}/api/collections/order_items/records`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(orderItemData)
          });
          
          if (!response.ok) {
            throw new Error(`Failed to create order item for ${item.name}`);
          }
          
          return await response.json();
        } else {
          // Authenticated user - use PocketBase client
          return pb.collection('order_items').create(orderItemData);
        }
      });

      await Promise.all(orderItemPromises);

      // Update stock quantities for each product
      const stockUpdatePromises = cart.map(async (item) => {
        try {
          if (!user) {
            // Guest order - update stock via public API
            const baseUrl = import.meta.env.VITE_POCKETBASE_URL || 'http://127.0.0.1:8090';
            const productResponse = await fetch(`${baseUrl}/api/collections/products/records/${item.id}`);
            if (!productResponse.ok) {
              throw new Error(`Failed to fetch product ${item.id}`);
            }
            const currentProduct = await productResponse.json();
            const newStock = Math.max(0, (currentProduct.stock || 0) - item.quantity);
            
            const updateResponse = await fetch(`${baseUrl}/api/collections/products/records/${item.id}`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                stock: newStock
              })
            });
            
            if (!updateResponse.ok) {
              throw new Error(`Failed to update stock for ${item.name}`);
            }
            
            console.log(`Updated ${item.name} stock: ${currentProduct.stock || 0} -> ${newStock}`);
          } else {
            // Authenticated user - use PocketBase client
            const currentProduct = await pb.collection('products').getOne(item.id);
            const newStock = Math.max(0, (currentProduct.stock || 0) - item.quantity);
            
            await pb.collection('products').update(item.id, {
              stock: newStock
            });
            
            console.log(`Updated ${item.name} stock: ${currentProduct.stock || 0} -> ${newStock}`);
          }
        } catch (error) {
          console.error(`Failed to update stock for ${item.name}:`, error);
        }
      });

      await Promise.all(stockUpdatePromises);

      // Clear cart and redirect
      clearCart();
      toast.success('Order placed and payment processed successfully!');
      navigate('/order-confirmation', { state: { orderId: order.id } });

    } catch (error) {
      console.error('Order error:', error);
      if (error.data) {
        console.error('Full error data:', JSON.stringify(error.data, null, 2));
        console.error('Error message:', error.message);
        
        // Show specific field errors if available
        if (error.data.data) {
          Object.keys(error.data.data).forEach(field => {
            console.error(`Field ${field}:`, error.data.data[field]);
          });
        }
      }
      toast.error('Failed to create order: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentError = (error: string) => {
    toast.error(error);
  };

  const subtotal = getTotalPrice();
  const shipping = subtotal > 50 ? 0 : 5; // Free shipping over 50 EUR
  const total = subtotal + shipping;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to cart
          </Button>
          <h1 className="text-3xl font-bold">Checkout</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column - Forms */}
          <div className="space-y-6">
            {/* Progress Indicator */}
            <div className="flex items-center justify-center space-x-4 mb-6">
              <div className={`flex items-center ${currentStep === 'shipping' ? 'text-blue-600' : 'text-green-600'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                  currentStep === 'shipping' 
                    ? 'border-blue-600 bg-blue-600 text-white' 
                    : 'border-green-600 bg-green-600 text-white'
                }`}>
                  1
                </div>
                <span className="ml-2 text-sm font-medium">Shipping</span>
              </div>
              <div className={`w-16 h-0.5 ${currentStep === 'payment' ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
              <div className={`flex items-center ${currentStep === 'payment' ? 'text-blue-600' : 'text-gray-400'}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-medium ${
                  currentStep === 'payment'
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-gray-100'
                }`}>
                  2
                </div>
                <span className="ml-2 text-sm font-medium">Payment</span>
              </div>
            </div>

            {/* Shipping Information Form */}
            {currentStep === 'shipping' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Shipping Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleShippingSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={shippingInfo.firstName}
                        onChange={(e) => handleInputChange('firstName', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={shippingInfo.lastName}
                        onChange={(e) => handleInputChange('lastName', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={shippingInfo.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder={user ? user.email : "Enter your email address"}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={shippingInfo.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      value={shippingInfo.address}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Street address"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={shippingInfo.city}
                        onChange={(e) => handleInputChange('city', e.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="postalCode">Postal Code *</Label>
                      <Input
                        id="postalCode"
                        value={shippingInfo.postalCode}
                        onChange={(e) => handleInputChange('postalCode', e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input
                      id="country"
                      value={shippingInfo.country}
                      onChange={(e) => handleInputChange('country', e.target.value)}
                      required
                    />
                  </div>

                  <div className="pt-4">
                    <Button 
                      type="submit" 
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3"
                    >
                      {loading ? 'Processing...' : 'Continue to Payment'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
            )}

            {/* Payment Form */}
            {currentStep === 'payment' && clientSecret && (
              <>
                <div className="mb-4">
                  <Button 
                    variant="outline" 
                    onClick={() => setCurrentStep('shipping')}
                    className="mb-4"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Shipping
                  </Button>
                </div>
                
                <StripePaymentForm
                  clientSecret={clientSecret}
                  amount={total}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </>
            )}
          </div>

          {/* Right Column - Order Summary */}
          <div>
            <Card className="sticky top-8">
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Cart Items */}
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <img
                        src={item.images[0]}
                        alt={item.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm leading-tight">
                          {item.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          Qty: {item.quantity} × {item.price} EUR
                        </p>
                      </div>
                      <div className="text-sm font-medium">
                        {(item.price * item.quantity).toFixed(2)} EUR
                      </div>
                    </div>
                  ))}
                </div>

                <Separator />

                {/* Totals */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal</span>
                    <span>{subtotal.toFixed(2)} EUR</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Shipping</span>
                    <span>
                      {shipping === 0 ? 'Free' : `${shipping.toFixed(2)} EUR`}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{total.toFixed(2)} EUR</span>
                  </div>
                </div>

                {shipping === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-green-800 text-xs">
                      🎉 You qualify for free shipping!
                    </p>
                  </div>
                )}

                {/* Payment Information */}
                {currentStep === 'shipping' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-800 text-sm">
                      💳 After shipping information, you'll complete your payment securely with Stripe.
                    </p>
                  </div>
                )}

                {currentStep === 'payment' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-green-800 text-sm">
                      🔒 Your payment information is secure and encrypted by Stripe.
                    </p>
                  </div>
                )}

                <p className="text-xs text-gray-500 text-center">
                  By proceeding, you agree to our Terms of Service and Privacy Policy.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};