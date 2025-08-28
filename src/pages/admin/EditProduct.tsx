import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { pb } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X, ArrowLeft } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  description: string;
  short_description?: string;
  price: number;
  sale_price?: number;
  category: string;
  in_stock: boolean;
  stock?: number;
  image: string[];
  hover_image?: string;
  preparation?: {
    amount: string;
    temperature: string;
    steepTime: string;
    taste: string;
  };
}

const EditProduct: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
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

  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [existingHoverImage, setExistingHoverImage] = useState<string | null>(null);
  const [newMainImages, setNewMainImages] = useState<File[]>([]);
  const [newHoverImage, setNewHoverImage] = useState<File | null>(null);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [deleteHoverImage, setDeleteHoverImage] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      try {
        setFetchLoading(true);
        const record = await pb.collection('products').getOne<Product>(id);
        
        // Parse preparation data
        let preparation = {
          amount: '',
          temperature: '',
          steepTime: '',
          taste: '',
          grams: '',
          ml: ''
        };
        
        if (record.preparation) {
          if (typeof record.preparation === 'string') {
            try {
              preparation = { ...preparation, ...JSON.parse(record.preparation) };
            } catch (e) {
              console.warn('Could not parse preparation data');
            }
          } else {
            preparation = { ...preparation, ...record.preparation };
          }
        }
        
        setFormData({
          name: record.name,
          description: record.description || '',
          short_description: record.short_description || '',
          price: record.price.toString(),
          sale_price: record.sale_price ? record.sale_price.toString() : '',
          weight: record.category || '',
          in_stock: record.in_stock,
          stock: record.stock ? record.stock.toString() : '',
          preparation: preparation
        });
        
        setExistingImages(record.image || []);
        setExistingHoverImage(record.hover_image || null);
        
      } catch (error) {
        console.error('Error fetching product:', error);
        toast({
          title: "Error",
          description: "Failed to load product",
          variant: "destructive",
        });
        navigate('/admin/products');
      } finally {
        setFetchLoading(false);
      }
    };

    fetchProduct();
  }, [id, navigate, toast]);

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

  const handleNewMainImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const totalImages = existingImages.length - imagesToDelete.length + newMainImages.length;
      const available = 5 - totalImages;
      const newFiles = Array.from(files).slice(0, available);
      setNewMainImages(prev => [...prev, ...newFiles]);
    }
  };

  const handleNewHoverImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setNewHoverImage(file);
      setDeleteHoverImage(false);
    }
  };

  const removeExistingImage = (imageName: string) => {
    setImagesToDelete(prev => [...prev, imageName]);
  };

  const restoreExistingImage = (imageName: string) => {
    setImagesToDelete(prev => prev.filter(name => name !== imageName));
  };

  const removeNewMainImage = (index: number) => {
    setNewMainImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingHoverImage = () => {
    setDeleteHoverImage(true);
  };

  const restoreExistingHoverImage = () => {
    setDeleteHoverImage(false);
  };

  const removeNewHoverImage = () => {
    setNewHoverImage(null);
  };

  // Drag and drop handlers for reordering existing images
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      return;
    }

    const newImages = [...existingImages];
    const draggedImage = newImages[draggedIndex];
    
    // Remove dragged item
    newImages.splice(draggedIndex, 1);
    
    // Insert at new position
    newImages.splice(dropIndex, 0, draggedImage);
    
    setExistingImages(newImages);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const getImageUrl = (imageName: string) => {
    try {
      return pb.files.getURL({ id, collectionId: 'az4zftchp7yppc0', collectionName: 'products' }, imageName);
    } catch {
      return `http://127.0.0.1:8090/api/files/az4zftchp7yppc0/${id}/${imageName}`;
    }
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
      data.append('category', formData.weight);
      data.append('in_stock', formData.in_stock.toString());
      data.append('stock', formData.stock || '0');
      
      // Add preparation data as JSON if any field is filled
      const hasPreparationData = Object.values(formData.preparation).some(value => value.trim() !== '');
      if (hasPreparationData) {
        data.append('preparation', JSON.stringify(formData.preparation));
      }
      
      // Calculate final image list (existing - deleted + new)
      const finalImages = existingImages.filter(img => !imagesToDelete.includes(img));
      
      console.log('🖼️ EditProduct - Image update:', {
        existingImages,
        imagesToDelete,
        finalImages,
        newMainImages: newMainImages.length,
        existingHoverImage,
        deleteHoverImage,
        newHoverImage: !!newHoverImage
      });
      
      // Set the remaining existing images first
      finalImages.forEach(imageName => {
        data.append('image', imageName);
      });
      
      // Add new main images
      newMainImages.forEach((file) => {
        data.append('image', file);
      });
      
      // Handle hover image
      if (deleteHoverImage) {
        // If deleting hover image and no new one, set to empty
        data.append('hover_image', '');
      } else if (newHoverImage) {
        // If new hover image, use it
        data.append('hover_image', newHoverImage);
      } else if (existingHoverImage && !deleteHoverImage) {
        // Keep existing hover image
        data.append('hover_image', existingHoverImage);
      }

      await pb.collection('products').update(id!, data);
      
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      
      // Navigate back to products management
      navigate('/admin/products');
      
    } catch (error: any) {
      console.error('Error updating product:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="space-y-6">
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
            <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
            <p className="text-gray-600">Loading product data...</p>
          </div>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-900">Edit Product</h1>
          <p className="text-gray-600">Modify product information</p>
        </div>
      </div>

      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>Product Details</CardTitle>
          <CardDescription>Update the product information below</CardDescription>
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

            {/* Existing Images */}
            {existingImages.length > 0 && (
              <div className="space-y-2">
                <Label>Current Main Images (Drag to reorder)</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {existingImages.map((imageName, index) => (
                    <div 
                      key={index} 
                      className={`relative group cursor-move ${
                        draggedIndex === index ? 'opacity-50 scale-95' : ''
                      }`}
                      draggable={!imagesToDelete.includes(imageName)}
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                    >
                      <img
                        src={getImageUrl(imageName)}
                        alt={`Current ${index + 1}`}
                        className={`w-full h-32 object-cover rounded-lg border-2 transition-all ${
                          imagesToDelete.includes(imageName) 
                            ? 'opacity-50 grayscale border-red-300' 
                            : draggedIndex === index 
                              ? 'border-blue-400' 
                              : 'border-transparent hover:border-gray-300'
                        }`}
                      />
                      
                      {/* Position indicator */}
                      <div className="absolute top-1 left-1 bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">
                        {index + 1}
                      </div>
                      
                      {/* Delete/Restore button */}
                      {!imagesToDelete.includes(imageName) ? (
                        <button
                          type="button"
                          onClick={() => removeExistingImage(imageName)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => restoreExistingImage(imageName)}
                          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white rounded px-2 py-1 text-xs"
                        >
                          Restore
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-gray-500">
                  💡 Drag images to reorder them. The first image will be the main product image.
                </p>
              </div>
            )}

            {/* New Main Images Upload */}
            <div className="space-y-2">
              <Label>Add New Main Images</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleNewMainImageUpload}
                  className="hidden"
                  id="new-main-image-upload"
                />
                <label htmlFor="new-main-image-upload" className="cursor-pointer">
                  <div className="text-center">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-blue-600 hover:text-blue-500">
                          Click to upload new images
                        </span>{' '}
                        or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG up to 10MB each</p>
                    </div>
                  </div>
                </label>
              </div>
              
              {/* New Images Preview */}
              {newMainImages.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mt-4">
                  {newMainImages.map((file, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`New ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewMainImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hover Images */}
            <div className="space-y-4">
              {/* Existing Hover Image */}
              {existingHoverImage && (
                <div className="space-y-2">
                  <Label>Current Hover Image</Label>
                  <div className="relative group inline-block">
                    <img
                      src={getImageUrl(existingHoverImage)}
                      alt="Current hover"
                      className={`w-32 h-32 object-cover rounded-lg ${
                        deleteHoverImage ? 'opacity-50 grayscale' : ''
                      }`}
                    />
                    {!deleteHoverImage ? (
                      <button
                        type="button"
                        onClick={removeExistingHoverImage}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={restoreExistingHoverImage}
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white rounded px-2 py-1 text-xs"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* New Hover Image Upload */}
              <div className="space-y-2">
                <Label>Upload New Hover Image</Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleNewHoverImageUpload}
                    className="hidden"
                    id="new-hover-image-upload"
                  />
                  <label htmlFor="new-hover-image-upload" className="cursor-pointer">
                    <div className="text-center">
                      <Upload className="mx-auto h-8 w-8 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">Click to upload new hover image</p>
                    </div>
                  </label>
                </div>
                
                {/* New Hover Image Preview */}
                {newHoverImage && (
                  <div className="relative group inline-block">
                    <img
                      src={URL.createObjectURL(newHoverImage)}
                      alt="New hover preview"
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={removeNewHoverImage}
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
                Update Product
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditProduct;