import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Package, Mail, Home } from 'lucide-react';

export const OrderConfirmation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const orderId = location.state?.orderId;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-12">
        {/* Success Icon */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Order Confirmed!</h1>
          <p className="text-gray-600">
            Thank you for your purchase. Your order has been successfully placed.
          </p>
        </div>

        {/* Order Details */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {orderId && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Order ID</p>
                <p className="font-mono text-lg font-medium">{orderId}</p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Status</p>
                <p className="font-medium text-blue-600">Processing</p>
              </div>
              <div>
                <p className="text-gray-600">Estimated Delivery</p>
                <p className="font-medium">3-5 business days</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What's Next */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>What happens next?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">Order Confirmation</h4>
                  <p className="text-sm text-gray-600">
                    You'll receive an email confirmation with your order details.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">Preparation</h4>
                  <p className="text-sm text-gray-600">
                    We'll carefully prepare and package your tea products.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Delivery</h4>
                  <p className="text-sm text-gray-600">
                    Your order will be delivered to your specified address.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => navigate('/')}
            className="bg-black hover:bg-gray-800 text-white"
          >
            Continue Shopping
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/account/orders')}
          >
            View Orders
          </Button>
        </div>

        {/* Support */}
        <div className="text-center mt-8">
          <p className="text-sm text-gray-500">
            Need help? Contact us at{' '}
            <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
              support@example.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};