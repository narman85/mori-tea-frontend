import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pb } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, X } from 'lucide-react';
import DraggableImageGrid from './DraggableImageGrid';
import { uploadMultipleToImgur, uploadToImgur } from '@/utils/imgur-upload';

interface AddProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductAdded: () => void;
}

const AddProductModal: React.FC<AddProductModalProps> = ({ open, onOpenChange, onProductAdded }) => {
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

  const handleMainImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      const maxSize = 10 * 1024 * 1024; // 10MB
      const validFiles: File[] = [];
      const invalidFiles: string[] = [];

      files.forEach(file => {
        if (file.size > maxSize) {
          invalidFiles.push(`${file.name} (${Math.round(file.size / 1024 / 1024 * 100) / 100}MB)`);
        } else {
          validFiles.push(file);
        }
      });

      if (invalidFiles.length > 0) {
        toast({
          title: "File Size Warning",
          description: `Some files are too large (max 10MB): ${invalidFiles.join(', ')}`,
          variant: "destructive",
        });
      }

      if (validFiles.length > 0) {
        setMainImages(prev => {
          const combined = [...prev, ...validFiles];
          if (combined.length > 4) {
            toast({
              title: "Too Many Images",
              description: `Maximum 4 main images allowed. Only first 4 will be kept.`,
              variant: "destructive",
            });
            return combined.slice(0, 4);
          }
          return combined;
        });
      }
    }
  };

  const handleHoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 10 * 1024 * 1024; // 10MB

      if (file.size > maxSize) {
        toast({
          title: "File Size Warning",
          description: `File is too large (max 10MB): ${Math.round(file.size / 1024 / 1024 * 100) / 100}MB`,
          variant: "destructive",
        });
        return;
      }

      setHoverImage(file);
    }
  };

  const removeMainImage = (index: number) => {
    setMainImages(prev => prev.filter((_, i) => i !== index));
  };

  const removeHoverImage = () => {
    setHoverImage(null);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      short_description: '',
      price: '',
      sale_price: '',
      weight: '',
      in_stock: true,
      preparation: {
        amount: '',
        temperature: '',
        steepTime: '',
        taste: ''
      }
    });
    setImageFiles([]);
    setMainImages([]);
    setHoverImage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.price) {
      toast({
        title: "Error",
        description: "Name and price are required",
        variant: "destructive",
      });
      return;
    }

    if (isNaN(Number(formData.price)) || Number(formData.price) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    // Check if user is authenticated
    if (!pb.authStore.isValid) {
      toast({
        title: "Error",
        description: "You must be logged in to add products",
        variant: "destructive",
      });
      return;
    }


    setLoading(true);

    try {
      let record;

      // Get the highest display_order and add 1 for new product
      const existingProducts = await pb.collection('products').getFullList({
        fields: 'display_order',
        sort: '-display_order',
        limit: 1
      });
      
      const nextOrder = existingProducts.length > 0 
        ? (existingProducts[0].display_order || 0) + 1 
        : 1;

      // Check preparation data
      const hasPreparationData = Object.values(formData.preparation).some(value => {
        if (typeof value === 'string') {
          return value.trim() !== '';
        }
        return false;
      });

      // Upload images to Imgur first
      let uploadedImageUrls: string[] = [];
      let uploadedHoverImageUrl = '';
      
      if (mainImages.length > 0) {
        toast({
          title: "Uploading images...",
          description: "Please wait while we upload your images",
        });
        
        try {
          uploadedImageUrls = await uploadMultipleToImgur(mainImages);
        } catch (uploadError) {
          toast({
            title: "Image Upload Failed",
            description: "Failed to upload images. Please try again.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }
      
      if (hoverImage) {
        try {
          uploadedHoverImageUrl = await uploadToImgur(hoverImage);
        } catch (uploadError) {
          toast({
            title: "Hover Image Upload Failed",
            description: "Failed to upload hover image. Please try again.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }
      
      // Create product with Imgur URLs in the images field
      const productData: any = {
        name: formData.name,
        description: formData.description || '',
        short_description: formData.short_description || '',
        price: Number(formData.price),
        sale_price: formData.sale_price ? Number(formData.sale_price) : 0,
        weight: formData.weight ? `${formData.weight}g` : '',
        in_stock: formData.in_stock,
        stock: Number(formData.stock) || 0,
        display_order: nextOrder,
        // Store Imgur URLs in a JSON field
        images: uploadedImageUrls,
        hover_image: uploadedHoverImageUrl || ''
      };
      
      // Add preparation data if available
      if (hasPreparationData) {
        const preparationData = {
          ...formData.preparation,
          amount: formData.preparation.grams && formData.preparation.ml 
            ? `${formData.preparation.grams}g per ${formData.preparation.ml}ml`
            : formData.preparation.amount || ''
        };
        delete preparationData.grams;
        delete preparationData.ml;
        productData.preparation = JSON.stringify(preparationData);
      }
      
      // If we still need to upload files to PocketBase (for backward compatibility)
      if (mainImages.length > 0 || hoverImage) {
        const data = new FormData();
        
        // Add all fields to FormData
        Object.keys(productData).forEach(key => {
          if (key === 'images') {
            // Skip images array as PocketBase expects files
          } else {
            data.append(key, productData[key].toString());
          }
        });
        
        // Add main images as files (PocketBase will store them)
        mainImages.forEach((file) => {
          data.append('image', file);
        });

        // Add hover image file if exists
        if (hoverImage) {
          data.append('hover_image', hoverImage);
        }

        record = await pb.collection('products').create(data);
        
      } else {
        // No images - use simple JSON object
        const productData: any = {
          name: formData.name,
          description: formData.description || '',
          short_description: formData.short_description || '',
          price: parseFloat(formData.price),
          sale_price: formData.sale_price ? parseFloat(formData.sale_price) : null,
          category: formData.weight ? `${formData.weight}g` : '',
          in_stock: formData.in_stock,
          stock: parseInt(formData.stock) || 0,
          display_order: nextOrder,
        };

        // Add preparation data if any field is filled
        if (hasPreparationData) {
          productData.preparation = formData.preparation;
        }
        record = await pb.collection('products').create(productData);
      }

      
      toast({
        title: "Success!",
        description: "Product added successfully",
      });

      resetForm();
      onOpenChange(false);
      onProductAdded();

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to create product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Add a new product to your store. Fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Product Name */}
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

          {/* Short Description for Cards */}
          <div className="space-y-2">
            <Label htmlFor="short_description">Short Description (for product cards)</Label>
            <div className="relative">
              <Input
                id="short_description"
                value={formData.short_description}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 70);
                  handleInputChange('short_description', value);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const paste = (e.clipboardData || (window as any).clipboardData).getData('text');
                  const value = paste.slice(0, 70);
                  handleInputChange('short_description', value);
                }}
                placeholder="Brief description for product cards (max 70 characters)"
                maxLength={70}
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-xs text-gray-400">
                {formData.short_description.length}/70
              </div>
            </div>
          </div>

          {/* Full Description for Detail Page */}
          <div className="space-y-2">
            <Label htmlFor="description">Full Description (for product detail page)</Label>
            <div className="relative">
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  const value = e.target.value.slice(0, 500);
                  handleInputChange('description', value);
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const paste = (e.clipboardData || (window as any).clipboardData).getData('text');
                  const value = paste.slice(0, 500);
                  handleInputChange('description', value);
                }}
                placeholder="Detailed description for product detail page (max 500 characters)"
                rows={4}
                maxLength={500}
              />
              <div className="absolute bottom-2 right-3 text-xs text-gray-400 bg-white px-1">
                {formData.description.length}/500
              </div>
            </div>
          </div>

          {/* Price, Sale Price, Weight and Stock */}
          <div className="grid grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Price ($) *</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => handleInputChange('price', e.target.value)}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_price">Sale Price ($)</Label>
              <Input
                id="sale_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.sale_price}
                onChange={(e) => handleInputChange('sale_price', e.target.value)}
                placeholder="Discount price"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (grams)</Label>
              <div className="relative">
                <Input
                  id="weight"
                  type="number"
                  min="1"
                  value={formData.weight}
                  onChange={(e) => handleInputChange('weight', e.target.value)}
                  placeholder="Enter weight"
                  className="pr-8"
                />
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-sm text-gray-500">
                  g
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stock Quantity *</Label>
              <Input
                id="stock"
                type="number"
                min="0"
                value={formData.stock}
                onChange={(e) => handleInputChange('stock', e.target.value)}
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* Main Product Images */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Main Product Images</Label>
              <p className="text-sm text-gray-500 mt-1">Upload up to 4 main product images (10MB each)</p>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <Label htmlFor="main-images" className="cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Click to upload main images
                  </span>
                  <span className="text-sm text-gray-500 block">or drag and drop</span>
                </Label>
                <Input
                  id="main-images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleMainImagesUpload}
                  className="hidden"
                />
                <p className="text-xs text-gray-400">PNG, JPG, WebP up to 10MB each</p>
              </div>
            </div>

            {mainImages.length > 0 && (
              <DraggableImageGrid
                images={mainImages}
                onReorder={setMainImages}
                onRemove={removeMainImage}
                labelPrefix="Main"
                labelColor="bg-black bg-opacity-50"
              />
            )}
          </div>

          {/* Hover Image */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Hover Image (Optional)</Label>
              <p className="text-sm text-gray-500 mt-1">Image shown when hovering over product card</p>
            </div>
            
            <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 text-center hover:border-orange-400 transition-colors">
              <div className="space-y-2">
                {hoverImage ? (
                  <div className="relative inline-block">
                    <img
                      src={URL.createObjectURL(hoverImage)}
                      alt="Hover preview"
                      className="w-24 h-24 object-cover rounded-lg border mx-auto"
                    />
                    <button
                      type="button"
                      onClick={removeHoverImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute bottom-1 left-1 bg-orange-500 text-white text-xs px-1 py-0.5 rounded">
                      Hover
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto bg-orange-100 rounded-lg flex items-center justify-center">
                      <Upload className="h-8 w-8 text-orange-500" />
                    </div>
                    <Label htmlFor="hover-image" className="cursor-pointer">
                      <span className="text-sm font-medium text-orange-600 hover:text-orange-500">
                        Click to upload hover image
                      </span>
                    </Label>
                  </>
                )}
                <Input
                  id="hover-image"
                  type="file"
                  accept="image/*"
                  onChange={handleHoverImageUpload}
                  className="hidden"
                />
              </div>
            </div>
          </div>

          {/* Tea Preparation Guide (Optional) */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2 mb-2">
              <Label className="text-base font-medium">Tea Preparation Guide (Optional)</Label>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Fill these fields if this is a tea product to show preparation instructions
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount</Label>
                <div className="flex gap-2 items-center">
                  <Input
                    value={formData.preparation.grams || ''}
                    onChange={(e) => handlePreparationChange('grams', e.target.value)}
                    placeholder="3"
                    className="w-20"
                    maxLength="5"
                  />
                  <span className="text-sm text-gray-600">g per</span>
                  <Input
                    value={formData.preparation.ml || ''}
                    onChange={(e) => handlePreparationChange('ml', e.target.value)}
                    placeholder="500"
                    className="w-24"
                  />
                  <span className="text-sm text-gray-600">ml</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="prep-temperature">Temperature (e.g., "80-85°C")</Label>
                <Input
                  id="prep-temperature"
                  value={formData.preparation.temperature}
                  onChange={(e) => handlePreparationChange('temperature', e.target.value)}
                  placeholder="80"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="prep-steeptime">Steep Time (e.g., "2-3 minutes")</Label>
                <Input
                  id="prep-steeptime"
                  value={formData.preparation.steepTime}
                  onChange={(e) => handlePreparationChange('steepTime', e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prep-taste">Taste Profile (e.g., "Light & floral")</Label>
                <Input
                  id="prep-taste"
                  value={formData.preparation.taste}
                  onChange={(e) => handlePreparationChange('taste', e.target.value)}
                  placeholder="Rich Smooth"
                />
              </div>
            </div>
          </div>

          {/* Switches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="in_stock">In Stock</Label>
              <Switch
                id="in_stock"
                checked={formData.in_stock}
                onCheckedChange={(checked) => handleInputChange('in_stock', checked)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductModal;