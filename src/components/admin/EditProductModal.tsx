import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { pb } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface Product {
  id: string;
  name: string;
  description?: string;
  short_description?: string;
  price: number;
  sale_price?: number;
  category?: string;
  in_stock?: boolean;
  stock?: number;
  image?: string[];
  hover_image?: string;
  preparation?: any;
  display_order?: number;
}

interface EditProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProductUpdated: () => void;
  product: Product;
}

// Sortable Image Item Component
const SortableImageItem = ({ 
  id, 
  index, 
  imageUrl, 
  onRemove 
}: { 
  id: string; 
  index: number; 
  imageUrl: string; 
  onRemove: () => void; 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-white rounded-lg border-2 ${
        isDragging ? 'border-blue-400 shadow-lg scale-105' : 'border-gray-200'
      } transition-all duration-200`}
    >
      <div className="relative">
        <img
          src={imageUrl}
          alt={`Image ${index + 1}`}
          className="w-full h-24 object-cover rounded-lg"
        />
        
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="absolute top-1 left-1 bg-gray-800/70 text-white rounded p-1 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {/* Position indicator */}
        <div className="absolute bottom-1 left-1 bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
          #{index + 1}
        </div>
        
        {/* Delete button */}
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete image"
        >
          ×
        </button>
      </div>
    </div>
  );
};

const EditProductModal: React.FC<EditProductModalProps> = ({ 
  open, 
  onOpenChange, 
  onProductUpdated, 
  product 
}) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Main images and hover image
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newHoverImage, setNewHoverImage] = useState<File | null>(null);
  
  // Current images from database
  const [currentImages, setCurrentImages] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

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
      taste: ''
    }
  });


  // Load product data when modal opens
  useEffect(() => {
    if (product && open) {
      console.log('🔍 EditModal loading product:', product.name);
      console.log('🔍 Product stock field:', product.stock, typeof product.stock);
      console.log('🔍 Product in_stock field:', product.in_stock, typeof product.in_stock);
      
      // Extract weight from category (remove 'g' suffix)
      const extractWeight = (category: string) => {
        if (!category) return '';
        return category.endsWith('g') ? category.slice(0, -1) : category;
      };

      setFormData({
        name: product.name || '',
        description: product.description || '',
        short_description: product.short_description || '',
        price: product.price?.toString() || '',
        sale_price: product.sale_price?.toString() || '',
        weight: extractWeight(product.category || ''),
        in_stock: product.in_stock ?? true,
        stock: product.stock?.toString() || '0',
        preparation: (() => {
          const prep = product.preparation || {
            amount: '',
            temperature: '',
            steepTime: '',
            taste: ''
          };
          
          // Parse amount into grams and ml if it exists
          if (prep.amount && prep.amount.includes('g per') && prep.amount.includes('ml')) {
            const match = prep.amount.match(/(\d{1,5})g per (\d+)ml/);
            if (match) {
              return {
                ...prep,
                grams: match[1],
                ml: match[2]
              };
            }
          }
          
          return {
            ...prep,
            grams: '',
            ml: ''
          };
        })()
      });
      
      // Set current images from product
      setCurrentImages(product.image || []);
      setImagesToDelete([]);
      setNewImages([]);
      setNewHoverImage(null);
    }
  }, [product, open]);

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

  const handleImagesUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        const totalImages = currentImages.length + newImages.length + validFiles.length;
        if (totalImages > 10) {
          toast({
            title: "Too Many Images",
            description: `Maximum 10 total images allowed. Current: ${currentImages.length}, New: ${newImages.length + validFiles.length}`,
            variant: "destructive",
          });
          return;
        }
        
        addNewImages(validFiles);
      }
    }
  };

  const removeNewImage = (index: number) => {
    setNewImages(prev => prev.filter((_, i) => i !== index));
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

      setNewHoverImage(file);
    }
  };

  const removeNewHoverImage = () => {
    setNewHoverImage(null);
  };

  // Drag and drop handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setCurrentImages((items) => {
        const oldIndex = items.findIndex((item) => `image-${item}` === active.id);
        const newIndex = items.findIndex((item) => `image-${item}` === over.id);
        
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const removeCurrentImage = (index: number) => {
    const imageToDelete = currentImages[index];
    setImagesToDelete(prev => [...prev, imageToDelete]);
    setCurrentImages(prev => prev.filter((_, i) => i !== index));
  };

  const addNewImages = (files: File[]) => {
    setNewImages(prev => [...prev, ...files]);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      short_description: '',
      price: '',
      weight: '',
      in_stock: true,
      preparation: {
        amount: '',
        temperature: '',
        steepTime: '',
        taste: ''
      }
    });
    setCurrentImages([]);
    setImagesToDelete([]);
    setNewImages([]);
    setNewHoverImage(null);
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

    const priceValue = parseFloat(formData.price);
    if (isNaN(priceValue) || priceValue <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid price",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const hasPreparationData = Object.values(formData.preparation).some(value => {
        if (typeof value === 'string') {
          return value.trim() !== '';
        }
        return false;
      });
      
      // Prepare final images array (current - deleted + new)
      const finalImages = [...currentImages];
      
      // Handle image operations
      const imageFormData = new FormData();
      
      // Add text fields
      imageFormData.append('name', formData.name);
      imageFormData.append('price', priceValue.toString());
      imageFormData.append('sale_price', formData.sale_price || '');
      imageFormData.append('in_stock', formData.in_stock.toString());
      imageFormData.append('stock', formData.stock || '0');
      imageFormData.append('description', formData.description || '');
      imageFormData.append('short_description', formData.short_description || '');
      imageFormData.append('category', formData.weight ? `${formData.weight}g` : '');
      imageFormData.append('display_order', (product?.display_order || 0).toString());
      
      console.log('Updating product with stock:', formData.stock);
      console.log('Updating product with in_stock:', formData.in_stock);
      
      if (hasPreparationData) {
        // Combine grams and ml into amount field
        const preparationData = {
          ...formData.preparation,
          amount: formData.preparation.grams && formData.preparation.ml 
            ? `${formData.preparation.grams}g per ${formData.preparation.ml}ml`
            : formData.preparation.amount || ''
        };
        // Remove separate grams and ml fields
        delete preparationData.grams;
        delete preparationData.ml;
        
        imageFormData.append('preparation', JSON.stringify(preparationData));
      }

      // Set current images in new order
      finalImages.forEach((imageName) => {
        imageFormData.append('image', imageName);
      });

      // Add new images
      newImages.forEach((file) => {
        imageFormData.append('image', file);
      });

      console.log('Updating product with:', {
        currentImagesCount: finalImages.length,
        newImagesCount: newImages.length,
        imagesToDelete: imagesToDelete
      });

      await pb.collection('products').update(product.id, imageFormData);

      // Handle hover image separately if provided
      if (newHoverImage) {
        console.log('Updating hover image...');
        const hoverData = new FormData();
        hoverData.append('hover_image', newHoverImage);
        await pb.collection('products').update(product.id, hoverData);
      }

      toast({
        title: "Success!",
        description: "Product updated successfully",
      });

      resetForm();
      onOpenChange(false);
      onProductUpdated();

    } catch (error: any) {
      console.error('Edit Product Error:', error);
      console.error('Error status:', error.status);
      console.error('Error response:', error.response);
      if (error.response?.data) {
        console.error('PocketBase error details:', JSON.stringify(error.response.data, null, 2));
      }
      
      toast({
        title: "Error",
        description: error.response?.data?.message || error.message || "Failed to update product",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Early return if product is null (after all hooks)
  if (!product) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Edit the product details. You can reorder, delete, or add new images.
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

          {/* Current Images Management */}
          {currentImages.length > 0 && (
            <div className="space-y-4">
              <Label className="text-base font-medium">Current Images ({currentImages.length})</Label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={currentImages.map((imageName) => `image-${imageName}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {currentImages.map((imageName, index) => {
                      const imageUrl = `http://127.0.0.1:8090/api/files/az4zftchp7yppc0/${product.id}/${imageName}`;
                      return (
                        <SortableImageItem
                          key={`image-${imageName}`}
                          id={`image-${imageName}`}
                          index={index}
                          imageUrl={imageUrl}
                          onRemove={() => removeCurrentImage(index)}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
              <p className="text-sm text-blue-600">
                💡 Drag the grip icon to reorder images, × to delete
              </p>
            </div>
          )}

          {/* Add New Images */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">Add New Images</Label>
              <p className="text-sm text-gray-500 mt-1">Upload additional images (max 10MB each). These will be added to existing images.</p>
            </div>
            
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
              <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <div className="space-y-2">
                <Label htmlFor="images" className="cursor-pointer">
                  <span className="text-sm font-medium text-blue-600 hover:text-blue-500">
                    Click to upload additional images
                  </span>
                </Label>
                <Input
                  id="images"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImagesUpload}
                  className="hidden"
                />
                <p className="text-xs text-gray-400">PNG, JPG, WebP up to 10MB each</p>
              </div>
            </div>

            {/* Show new images to be uploaded */}
            {newImages.length > 0 && (
              <>
                <p className="text-sm text-green-600 font-medium">
                  Images to add ({newImages.length}) - will be appended after existing images:
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {newImages.map((file, index) => (
                    <div key={`new-${index}`} className="relative">
                      <img
                        src={URL.createObjectURL(file)}
                        alt={`New ${index + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-green-300"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewImage(index)}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                      >
                        ×
                      </button>
                      <div className="absolute bottom-1 left-1 bg-green-500 text-white text-xs px-1.5 py-0.5 rounded">
                        +{index + 1}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Hover Image Upload */}
          <div className="space-y-4 border-t pt-4">
            <div>
              <Label className="text-base font-medium">Hover Image</Label>
              <p className="text-sm text-gray-500 mt-1">Upload a separate image to show on hover (optional)</p>
            </div>

            {/* Show current hover image if exists */}
            {product && product.hover_image && !newHoverImage && (
              <div className="mb-4">
                <p className="text-sm text-orange-600 font-medium mb-2">Current hover image:</p>
                <div className="relative inline-block">
                  <img
                    src={`http://127.0.0.1:8090/api/files/az4zftchp7yppc0/${product.id}/${product.hover_image}`}
                    alt="Current hover image"
                    className="w-24 h-24 object-cover rounded-lg border mx-auto"
                  />
                  <div className="absolute bottom-1 left-1 bg-orange-500 text-white text-xs px-1 py-0.5 rounded">
                    Current
                  </div>
                </div>
              </div>
            )}
            
            <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 text-center hover:border-orange-400 transition-colors">
              <div className="space-y-2">
                {newHoverImage ? (
                  <div className="relative inline-block">
                    <img
                      src={URL.createObjectURL(newHoverImage)}
                      alt="New hover preview"
                      className="w-24 h-24 object-cover rounded-lg border mx-auto"
                    />
                    <button
                      type="button"
                      onClick={removeNewHoverImage}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-1 left-1 bg-orange-500 text-white text-xs px-1 py-0.5 rounded">
                      New
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 mx-auto bg-orange-100 rounded-lg flex items-center justify-center">
                      <Upload className="h-8 w-8 text-orange-500" />
                    </div>
                    <Label htmlFor="hover-image" className="cursor-pointer">
                      <span className="text-sm font-medium text-orange-600 hover:text-orange-500">
                        {product && product.hover_image ? 'Click to replace hover image' : 'Click to upload hover image'}
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

          {/* Tea Preparation Guide */}
          <div className="space-y-4 border-t pt-4">
            <Label className="text-base font-medium">Tea Preparation Guide (Optional)</Label>
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
                <Label>Temperature</Label>
                <Input
                  value={formData.preparation.temperature}
                  onChange={(e) => handlePreparationChange('temperature', e.target.value)}
                  placeholder="80"
                />
              </div>
              <div className="space-y-2">
                <Label>Steep Time</Label>
                <Input
                  value={formData.preparation.steepTime}
                  onChange={(e) => handlePreparationChange('steepTime', e.target.value)}
                  placeholder="3"
                />
              </div>
              <div className="space-y-2">
                <Label>Taste Profile</Label>
                <Input
                  value={formData.preparation.taste}
                  onChange={(e) => handlePreparationChange('taste', e.target.value)}
                  placeholder="Rich Smooth"
                />
              </div>
            </div>
          </div>

          {/* In Stock Switch */}
          <div className="flex items-center justify-between">
            <Label htmlFor="in_stock">In Stock</Label>
            <Switch
              id="in_stock"
              checked={formData.in_stock}
              onCheckedChange={(checked) => handleInputChange('in_stock', checked)}
            />
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
              Update Product
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProductModal;