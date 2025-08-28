import React, { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductImageGalleryProps {
  images?: string[];
  productName: string;
  excludeHoverImage?: boolean; // Hide last image if it's a hover image (deprecated)
}

const ProductImageGallery = ({ images, productName, excludeHoverImage = false }: ProductImageGalleryProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const imageRef = useRef<HTMLDivElement>(null);

  // Process images - just show all provided images
  const processedImages = (() => {
    if (!images || images.length === 0) {
      return ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop&crop=center'];
    }
    
    return images;
  })();

  const safeImages = processedImages;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % safeImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + safeImages.length) % safeImages.length);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const currentX = e.clientX;
    const diff = startX - currentX;
    setTranslateX(diff);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    setIsDragging(false);
    
    if (Math.abs(translateX) > 30) {
      if (translateX > 0) {
        nextImage();
      } else {
        prevImage();
      }
    }
    setTranslateX(0);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only prevent default for specific cases to avoid passive listener warnings
    if (e.cancelable) {
      e.preventDefault();
    }
    setStartX(e.touches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // Only prevent default for specific cases to avoid passive listener warnings
    if (e.cancelable) {
      e.preventDefault();
    }
    const currentX = e.touches[0].clientX;
    const diff = startX - currentX;
    setTranslateX(diff);
  };

  const handleTouchEnd = () => {
    if (Math.abs(translateX) > 30) {
      if (translateX > 0) {
        nextImage();
      } else {
        prevImage();
      }
    }
    setTranslateX(0);
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setTranslateX(0);
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [isDragging]);

  return (
    <div className="w-full">
      {/* Main Image Display */}
      <div className="relative group mb-4">
        <div
          ref={imageRef}
          className="relative overflow-hidden cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={safeImages[currentImageIndex]}
            alt={`${productName} - Image ${currentImageIndex + 1}`}
            className={`w-full h-auto aspect-square object-cover shadow-sm transition-transform duration-200 ${
              isDragging ? 'opacity-90' : 'opacity-100'
            }`}
            style={{
              transform: `translateX(${-translateX}px)`,
            }}
            draggable={false}
          />
        </div>

        {/* Navigation Buttons */}
        {safeImages.length > 1 && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={prevImage}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={nextImage}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white/90 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </>
        )}
      </div>

      {/* Thumbnail Gallery */}
      {safeImages.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {safeImages.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentImageIndex(index)}
              className={`flex-shrink-0 w-16 h-16 border-2 transition-all ${
                index === currentImageIndex
                  ? 'border-primary shadow-sm'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <img
                src={image}
                alt={`${productName} thumbnail ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;