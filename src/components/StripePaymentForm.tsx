import React, { useState } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import {
  useStripe,
  useElements,
  PaymentElement,
} from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';
import { useStripeContext } from '@/context/StripeContext';

interface StripePaymentFormProps {
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

// Internal payment form component
const PaymentForm: React.FC<{
  clientSecret: string;
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}> = ({ clientSecret, amount, onSuccess, onError }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setProcessing(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/order-confirmation`,
        },
        redirect: 'if_required'
      });

      if (error) {
        console.error('Payment error:', error);
        toast.error(error.message || 'Payment failed');
        onError(error.message || 'Payment failed');
      } else {
        toast.success('Payment successful!');
        onSuccess();
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      toast.error('An unexpected error occurred');
      onError('An unexpected error occurred');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment Details
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <PaymentElement 
            options={{
              layout: 'tabs',
            }}
          />
          
          <div className="pt-4">
            <Button 
              type="submit" 
              disabled={processing || !stripe || !elements}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                `Pay €${amount.toFixed(2)}`
              )}
            </Button>
          </div>
          
          <div className="text-xs text-gray-500 text-center">
            <p>Your payment information is secure and encrypted.</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

// Main wrapper component
export const StripePaymentForm: React.FC<StripePaymentFormProps> = ({
  clientSecret,
  amount,
  onSuccess,
  onError
}) => {
  const { stripePromise } = useStripeContext();

  const options = {
    clientSecret,
    appearance: {
      theme: 'stripe' as const,
      variables: {
        colorPrimary: '#0570de',
        colorBackground: '#ffffff',
        colorText: '#424770',
        colorDanger: '#df1b41',
        fontFamily: 'Ideal Sans, system-ui, sans-serif',
        spacingUnit: '2px',
        borderRadius: '4px',
      },
    },
  };

  return (
    <Elements stripe={stripePromise} options={options}>
      <PaymentForm
        clientSecret={clientSecret}
        amount={amount}
        onSuccess={onSuccess}
        onError={onError}
      />
    </Elements>
  );
};