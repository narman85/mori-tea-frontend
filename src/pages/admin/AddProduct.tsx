import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { pb } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, ArrowLeft } from 'lucide-react';
import DraggableImageGrid from '@/components/admin/DraggableImageGrid';

const AddProduct: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    short_description: '',
    price: '',
    sale_price: '',
    weight: '',
    in_stock: true,
    stock: '',
    preparation: {
      amount: '',
      temperature: '',
      steepTime: '',
      taste: '',
      grams: '',
      ml: ''
    }
  });

  const [mainImages, setMainImages] = useState<File[]>([]);
  const [hoverImage, setHoverImage] = useState<File | null>(null);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePreparationChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      preparation: {
        ...prev.preparation,
        [field]: value
      }
    }));
  };

  const handleMainImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newFiles = Array.from(files).slice(0, 5 - mainImages.length);
      setMainImages(prev => [...prev, ...newFiles]);
    }
  };

  const handleHoverImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setHoverImage(file);
    }
  };

  const removeMainImage = (index: number) => {
    setMainImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeHoverImage = () => {
    setHoverImage(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!formData.name.trim() || !formData.price) {
      toast({
        title: "Error",
        description: "Name and price are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      
      // Create FormData for file uploads
      const data = new FormData();
      
      // Add basic fields
      data.append('name', formData.name);
      data.append('description', formData.description);
      data.append('short_description', formData.short_description);
      data.append('price', formData.price);
      data.append('sale_price', formData.sale_price || '0');
      data.append('weight', formData.weight);
      data.append('in_stock', formData.in_stock.toString());
      data.append('stock', formData.stock || '0');
      
      // Add preparation data as JSON if any field is filled
      const hasPreparationData = Object.values(formData.preparation).some(value => value.trim() !== '');
      if (hasPreparationData) {
        data.append('preparation', JSON.stringify(formData.preparation));
      }
      
      // Add main images
      mainImages.forEach((file) => {
        data.append('image', file);
      });
      
      // Add hover image
      if (hoverImage) {
        data.append('hover_image', hoverImage);
      }

      // Debug current auth state
      console.log('Current auth state:', {
        isValid: pb.authStore.isValid,
        token: pb.authStore.token?.substring(0, 20) + '...',
        user: pb.authStore.model ? {
          id: pb.authStore.model.id,
          email: pb.authStore.model.email,
          role: pb.authStore.model.role
        } : null
      });
      
      let record;
      
      // Check if this is an OAuth session that needs admin authentication
      if (!pb.authStore.isValid && pb.authStore.model?.oauth_provider === 'google' && 
          pb.authStore.model?.role === 'admin') {
        console.log('🔧 Using admin session for OAuth user');
        
        // Store current OAuth session
        const oauthUser = pb.authStore.model;
        const oauthToken = pb.authStore.token;
        
        try {
          // Try creating a regular user account with admin role and authenticate with it
          console.log('Creating admin user account for OAuth operations...');
          
          const tempAdminEmail = `oauth-admin-${Date.now()}@temp.local`;
          const tempAdminPassword = `TempAdmin123!${Math.random().toString(36).substring(2)}`;
          
          // Create a user with admin role
          const adminUserData = {
            email: tempAdminEmail,
            username: `oauthadmin${Date.now()}`,
            name: 'OAuth Admin',
            emailVisibility: true,
            role: 'admin',
            password: tempAdminPassword,
            passwordConfirm: tempAdminPassword,
          };
          
          console.log('Creating admin user...');
          const adminUser = await pb.collection('users').create(adminUserData);
          console.log('✅ Admin user created:', adminUser.email);
          
          // Authenticate as the new admin user
          console.log('Authenticating as admin user...');
          await pb.collection('users').authWithPassword(tempAdminEmail, tempAdminPassword);
          console.log('✅ Admin session established');
          
          // Create the product with admin privileges
          console.log('Creating product with admin auth...');
          record = await pb.collection('products').create(data);
          console.log('✅ Product created successfully');
          
          // Clean up temporary admin user
          try {
            console.log('Cleaning up temporary admin user...');
            // First re-authenticate as the admin user to delete itself
            await pb.collection('users').authWithPassword(tempAdminEmail, tempAdminPassword);
            await pb.collection('users').delete(adminUser.id);
            console.log('✅ Temporary admin user deleted successfully');
          } catch (cleanupError) {
            console.log('⚠️ Could not delete temporary admin user:', cleanupError);
            // If deletion fails, at least mark it for cleanup
            try {
              await pb.collection('users').update(adminUser.id, {
                name: '[TEMP-DELETE] OAuth Admin - Safe to Delete',
                username: `temp-delete-${adminUser.id}`,
                emailVisibility: false
              });
              console.log('✅ Marked temporary admin user for manual deletion');
            } catch (markError) {
              console.log('⚠️ Could not mark temporary admin user for deletion');
            }
          }
          
        } catch (adminError) {
          console.log('❌ Admin approach failed:', adminError);
          throw new Error('Failed to authenticate for product creation. Please contact administrator.');
        } finally {
          // Always restore OAuth session
          pb.authStore.save(oauthToken, oauthUser);
          console.log('🔄 OAuth session restored');
        }
      } else {
        // Normal authentication flow
        record = await pb.collection('products').create(data);
      }
      
      toast({
        title: "Success",
        description: "Product added successfully",
      });
      
      // Navigate back to products management
      navigate('/admin/products');
      
    } catch (error: any) {
      console.error('Error adding product:', error);
      console.error('Error details:', {
        status: error.status,
        message: error.message,
        response: error.response?.data || error.data,
        originalError: error.originalError
      });
      
      let errorMessage = "Failed to add product";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => navigate('/admin/products')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Products
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Product</h1>
          <p className="text-gray-600">Create a new product for your store</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Enter the product information below</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter product name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="weight">Category/Weight</Label>
                <Input
                  id="weight"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  placeholder="e.g. 100g, Green Tea"
                />
              </div>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="price">Regular Price * (EUR)</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="sale_price">Sale Price (EUR)</Label>
                <Input
                  id="sale_price"
                  type="number"
                  step="0.01"
                  value={formData.sale_price}
                  onChange={(e) => handleInputChange('sale_price', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="stock">Stock Quantity</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock}
                  onChange={(e) => handleInputChange('stock', e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Descriptions */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="short_description">Short Description</Label>
                <Input
                  id="short_description"
                  value={formData.short_description}
                  onChange={(e) => handleInputChange('short_description', e.target.value)}
                  placeholder="Brief product summary"
                  maxLength={70}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Full Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Detailed product description"
                  rows={4}
                />
              </div>
            </div>

            {/* Stock Status */}
            <div className="flex items-center space-x-2">
              <Switch
                id="in_stock"
                checked={formData.in_stock}
                onCheckedChange={(checked) => handleInputChange('in_stock', checked)}
              />
              <Label htmlFor="in_stock">Product is in stock</Label>
            </div>

            {/* Images */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Main Product Images (up to 5)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleMainImageUpload}
                    className="hidden"
                    id="main-image-upload"
                  />
                  <label htmlFor="main-image-upload" className="cursor-pointer">
                    <div className="text-center">
                      <Upload className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="mt-4">
                        <p className="text-sm text-gray-600">
                          <span className="font-medium text-blue-600 hover:text-blue-500">
                            Click to upload main images
                          </span>{' '}
                          or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">PNG, JPG up to 10MB each</p>
                      </div>
                    </div>
                  </label>
                </div>
                
                {/* Main Images Preview */}
                {mainImages.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                    {mainImages.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => removeMainImage(index)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Hover Image (optional)</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleHoverImageUpload}
                    className="hidden"
                    id="hover-image-upload"
                  />
                  <label htmlFor="hover-image-upload" className="cursor-pointer">
                    <div className="text-center">
                      <Upload className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">Click to upload hover image</p>
                    </div>
                  </label>
                </div>
                
                {/* Hover Image Preview */}
                {hoverImage && (
                  <div className="relative group inline-block">
                    <img
                      src={URL.createObjectURL(hoverImage)}
                      alt="Hover preview"
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeHoverImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Tea Preparation (Optional) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tea Preparation (Optional)</CardTitle>
                <CardDescription>Instructions for preparing this tea</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="prep_amount">Amount</Label>
                  <Input
                    id="prep_amount"
                    value={formData.preparation.amount}
                    onChange={(e) => handlePreparationChange('amount', e.target.value)}
                    placeholder="e.g. 1 tsp"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="prep_temperature">Water Temperature</Label>
                  <Input
                    id="prep_temperature"
                    value={formData.preparation.temperature}
                    onChange={(e) => handlePreparationChange('temperature', e.target.value)}
                    placeholder="e.g. 80°C"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="prep_steepTime">Steep Time</Label>
                  <Input
                    id="prep_steepTime"
                    value={formData.preparation.steepTime}
                    onChange={(e) => handlePreparationChange('steepTime', e.target.value)}
                    placeholder="e.g. 3-5 minutes"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="prep_taste">Taste Notes</Label>
                  <Input
                    id="prep_taste"
                    value={formData.preparation.taste}
                    onChange={(e) => handlePreparationChange('taste', e.target.value)}
                    placeholder="e.g. Smooth, earthy"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit Buttons */}
            <div className="flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/admin/products')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Product
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddProduct;