import React, { useState, useEffect } from 'react';
import { X, Search, Loader } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { pb } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  price: number;
  sale_price?: number;
  category: string;
  image_url: string;
  description: string;
}

interface SearchPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SearchPopup: React.FC<SearchPopupProps> = ({ isOpen, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
    }
  }, [isOpen]);

  // Handle Escape key to close
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    const searchProducts = async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }

      setLoading(true);
      try {
        // Search products by name, description, or category
        const results = await pb.collection('products').getList(1, 10, {
          filter: `(name ~ "${searchTerm}" || description ~ "${searchTerm}" || category ~ "${searchTerm}") && in_stock = true`,
          sort: '-created'
        });
        
        setSearchResults(results.items);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search
    const timer = setTimeout(searchProducts, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleProductClick = (productId: string) => {
    navigate(`/product/${productId}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* Search Popup */}
      <div className={`fixed top-16 left-1/2 transform -translate-x-1/2 w-full max-w-2xl bg-white z-50 transition-all duration-300 ease-in-out shadow-2xl rounded-lg mx-4 ${
        isOpen ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}>
        
        {/* Header with Search Input */}
        <div className="flex items-center gap-4 p-4 md:p-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search for tea..."
              className="w-full pl-10 pr-4 py-3 focus:outline-none text-lg bg-transparent"
              autoFocus
            />
          </div>
          <Button
            onClick={onClose}
            variant="ghost"
            size="icon"
            className="flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Search Content */}
        <div className="max-h-[60vh] overflow-y-auto">
          {searchTerm.trim().length >= 2 && (
            <div className="p-4 md:p-6 pt-0">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader className="w-6 h-6 animate-spin text-gray-400" />
                  <span className="ml-2 text-gray-500">Searching...</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-gray-500 mb-4">
                    Found {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchTerm}"
                  </p>
                  {searchResults.map((product) => (
                    <div
                      key={product.id}
                      onClick={() => handleProductClick(product.id)}
                      className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition-colors"
                    >
                      <img
                        src={product.image_url || 'https://images.unsplash.com/photo-1576092768241-dec231879fc3'}
                        alt={product.name}
                        className="w-16 h-16 object-cover rounded-md"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-gray-900 truncate">
                          {product.name}
                        </h4>
                        <p className="text-sm text-gray-500 truncate">
                          {product.category}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {product.sale_price && product.sale_price > 0 ? (
                            <>
                              <span className="text-sm font-semibold text-red-600">
                                €{product.sale_price.toFixed(2)}
                              </span>
                              <span className="text-sm text-gray-400 line-through">
                                €{product.price.toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className="text-sm font-semibold text-gray-900">
                              €{product.price.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">
                    No products found for "{searchTerm}"
                  </p>
                  <p className="text-sm text-gray-400 mt-2">
                    Try searching with different keywords
                  </p>
                </div>
              )}
            </div>
          )}
          
          {searchTerm.trim().length === 1 && (
            <div className="p-4 md:p-6 pt-0 text-center text-gray-500">
              Type at least 2 characters to search
            </div>
          )}
          
          {searchTerm.trim() === '' && (
            <div className="p-4 md:p-6 pt-0">
              <div className="text-center py-8">
                <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">Start typing to search products</p>
                <p className="text-sm text-gray-400 mt-2">
                  Search by product name, category, or description
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};