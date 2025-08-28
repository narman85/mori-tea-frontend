// Stripe payment intent creation

interface PaymentIntent {
  client_secret: string;
  amount: number;
  currency: string;
}

interface PaymentResult {
  status: string;
  payment_method: {
    type: string;
    card: {
      brand: string;
      last4: string;
    };
  };
}

// This would typically be in a backend service
// For demo purposes, we'll simulate the payment intent creation
export async function createPaymentIntent(amount: number, currency: string = 'eur'): Promise<PaymentIntent> {
  // In a real application, this would be done on your backend
  // For demo purposes, we'll return a mock client secret
  
  const mockClientSecret = `pi_mock_${Date.now()}_secret_${Math.random().toString(36).substring(7)}`;
  
  return {
    client_secret: mockClientSecret,
    amount: amount * 100, // Stripe uses cents
    currency: currency,
  };
}

// Simulate Stripe webhook handling for payment confirmation
export function simulatePaymentSuccess(): Promise<PaymentResult> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        status: 'succeeded',
        payment_method: {
          type: 'card',
          card: {
            brand: 'visa',
            last4: '4242'
          }
        }
      });
    }, 2000); // Simulate 2 second processing time
  });
}