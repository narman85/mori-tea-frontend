import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { CreditCard, Loader2 } from 'lucide-react';

interface DemoPaymentFormProps {
  amount: number;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export const DemoPaymentForm: React.FC<DemoPaymentFormProps> = ({
  amount,
  onSuccess,
  onError
}) => {
  const [processing, setProcessing] = useState(false);
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvc, setCvc] = useState('');
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!cardNumber || !expiryDate || !cvc || !name) {
      toast.error('Please fill in all payment details');
      return;
    }

    setProcessing(true);

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Demo: Consider any card number starting with 4242 as successful
      if (cardNumber.startsWith('4242')) {
        toast.success('Payment successful!');
        onSuccess();
      } else {
        throw new Error('Your card was declined. Try using 4242 4242 4242 4242 for testing.');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      toast.error(errorMessage);
      onError(errorMessage);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment Details (Demo)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              placeholder="4242 4242 4242 4242 (test card)"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim())}
              maxLength={19}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="expiryDate">Expiry</Label>
              <Input
                id="expiryDate"
                placeholder="MM/YY"
                value={expiryDate}
                onChange={(e) => {
                  let value = e.target.value.replace(/\D/g, '');
                  if (value.length >= 2) {
                    value = value.substring(0, 2) + '/' + value.substring(2, 4);
                  }
                  setExpiryDate(value);
                }}
                maxLength={5}
                required
              />
            </div>
            <div>
              <Label htmlFor="cvc">CVC</Label>
              <Input
                id="cvc"
                placeholder="123"
                value={cvc}
                onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))}
                maxLength={3}
                required
              />
            </div>
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          </div>
          
          <div className="pt-4">
            <Button 
              type="submit" 
              disabled={processing}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                `Pay €${amount.toFixed(2)}`
              )}
            </Button>
          </div>
          
          <div className="text-xs text-gray-500 text-center space-y-1">
            <p>🔒 This is a demo payment form for testing purposes.</p>
            <p>💳 Use card number starting with <code className="bg-gray-100 px-1 rounded">4242</code> for successful payment</p>
            <p>❌ Any other number will be declined</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};