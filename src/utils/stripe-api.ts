// Real Stripe API integration via Vercel serverless functions
const API_BASE = import.meta.env.VITE_STRIPE_SERVER_URL || (
  typeof window !== 'undefined' && window.location.origin.includes('vercel.app') 
    ? window.location.origin 
    : 'http://localhost:3002'
);
const STRIPE_API_BASE = 'https://api.stripe.com/v1';

interface PaymentIntentResponse {
  id?: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
}

// Create real payment intent via backend API
export async function createStripePaymentIntent(
  amount: number, 
  currency: string = 'eur'
): Promise<PaymentIntentResponse> {
  
  try {
    const response = await fetch(`${API_BASE}/api/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount,
        currency
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    const paymentIntent = await response.json();
    
    return paymentIntent;
    
  } catch (error) {
    console.error('Error creating payment intent:', error);
    throw new Error('Failed to create payment intent. Please try again.');
  }
}

// Alternative: Mock implementation for development
export async function createMockPaymentIntent(
  amount: number, 
  currency: string = 'eur'
): Promise<PaymentIntentResponse> {
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate proper Stripe-format mock data
  const randomChars = () => Math.random().toString(36).substring(2, 10);
  const mockId = `pi_3${randomChars()}${randomChars()}`;
  const mockSecret = `${mockId}_secret_${randomChars()}${randomChars()}${randomChars()}`;
  
  return {
    id: mockId,
    client_secret: mockSecret,
    amount: Math.round(amount * 100),
    currency: currency,
    status: 'requires_payment_method'
  };
}