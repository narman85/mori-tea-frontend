import React, { useState, useRef, useEffect } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { CartSidebar } from './CartSidebar';
import { SearchPopup } from './SearchPopup';

interface HeaderProps {
  className?: string;
}

export const Header: React.FC<HeaderProps> = ({ className = '' }) => {
  const [selectedLanguage, setSelectedLanguage] = useState('EN');
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const { getTotalItems } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const languageOptions = [
    { code: 'EN', label: 'English' },
    { code: 'EST', label: 'Estonian' },
    { code: 'RU', label: 'Russian' }
  ];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const navigationItems: { label: string; href: string }[] = [
    { label: 'About', href: '/about' }
  ];

  return (
    <>
      <header className={`self-stretch flex w-full items-center justify-between text-sm font-normal leading-none px-4 md:px-8 lg:px-[150px] py-3 border-[rgba(239,239,239,1)] border-b ${className}`}>
        {/* Logo */}
        <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity">
          <img
            src="https://api.builder.io/api/v1/image/assets/TEMP/7d22d1b387c53084b9023edc3e88327476f862b4?placeholderIfAbsent=true"
            alt="Tea Company Logo"
            className="aspect-[4.37] object-contain w-20 md:w-[90px] lg:w-[105px] flex-shrink-0"
          />
        </button>
        
        {/* Desktop Navigation - Hidden */}
        <div className="hidden"></div>

        {/* Right Side - Icons */}
        <div className="flex items-center gap-2 md:gap-3 text-[rgba(76,76,76,1)]">
          
          {/* Language Dropdown - Show on tablet+ */}
          <div ref={dropdownRef} className="hidden md:relative md:flex items-center">
            <button 
              onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
              className="flex items-center gap-[3px] pl-2 md:pl-3 pr-1 md:pr-1.5 py-1.5 hover:bg-gray-50 transition-colors rounded"
            >
              <span className="text-xs md:text-sm">{selectedLanguage}</span>
              <ChevronDown className="w-2.5 md:w-3 h-2.5 md:h-3" />
            </button>
            
            {isLanguageDropdownOpen && (
              <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
                {languageOptions.map((option) => (
                  <button
                    key={option.code}
                    onClick={() => {
                      setSelectedLanguage(option.code);
                      setIsLanguageDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg transition-colors"
                  >
                    {option.code} - {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* About Button - Show on tablet+ */}
          <Link
            to="/about"
            className="hidden md:block px-3 py-1.5 text-xs md:text-sm text-[rgba(76,76,76,1)] hover:bg-gray-50 transition-colors rounded whitespace-nowrap"
          >
            About
          </Link>
          
          {/* Search Icon - Show on tablet+ */}
          <button 
            onClick={() => setIsSearchOpen(true)}
            className="hidden md:block aspect-[1] object-contain w-5 md:w-6 hover:opacity-70 transition-opacity"
          >
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/dbe42f7a2a6777f499b0c6e0cb6e210b255341e3?placeholderIfAbsent=true"
              alt="Search"
              className="w-full h-full"
            />
          </button>
          
          {/* User Account - Show on tablet+ */}
          <button 
            onClick={() => navigate(user ? '/account' : '/auth')}
            className="hidden md:block aspect-[1] object-contain w-5 md:w-6 hover:opacity-70 transition-opacity"
          >
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/f6d00f3370ac259b02aa149455d071c73852c30a?placeholderIfAbsent=true"
              alt="User account"
              className="w-full h-full"
            />
          </button>
          
          {/* Cart Button */}
          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative aspect-[1] object-contain w-5 md:w-6 hover:opacity-70 transition-opacity"
          >
            <img
              src="https://api.builder.io/api/v1/image/assets/TEMP/98f20a3e4542a7e60e90d13193239cb2efd2290d?placeholderIfAbsent=true"
              alt="Shopping cart"
              className="w-full h-full"
            />
            {getTotalItems() > 0 && (
              <span className="absolute -top-1.5 md:-top-2 -right-1.5 md:-right-2 bg-[rgba(173,29,24,1)] text-white text-xs rounded-full w-4 h-4 md:w-5 md:h-5 flex items-center justify-center font-medium">
                {getTotalItems()}
              </span>
            )}
          </button>

          {/* Mobile & Tablet Menu Button */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="xl:hidden p-1.5 md:p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Mobile & Tablet Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="xl:hidden fixed inset-0 z-50 bg-white">
          <div className="flex flex-col h-full">
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <button onClick={() => navigate('/')} className="hover:opacity-80 transition-opacity">
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/7d22d1b387c53084b9023edc3e88327476f862b4?placeholderIfAbsent=true"
                  alt="Tea Company Logo"
                  className="aspect-[4.37] object-contain w-20"
                />
              </button>
              <button 
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 flex flex-col p-4 space-y-2">
              {/* Search */}
              <button 
                onClick={() => {
                  setIsSearchOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 p-4 text-lg hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/dbe42f7a2a6777f499b0c6e0cb6e210b255341e3?placeholderIfAbsent=true"
                  alt="Search"
                  className="w-5 h-5"
                />
                <span>Search</span>
              </button>

              {/* Account */}
              <button 
                onClick={() => {
                  navigate(user ? '/account' : '/auth');
                  setIsMobileMenuOpen(false);
                }}
                className="flex items-center gap-3 p-4 text-lg hover:bg-gray-50 rounded-lg transition-colors text-left"
              >
                <img
                  src="https://api.builder.io/api/v1/image/assets/TEMP/f6d00f3370ac259b02aa149455d071c73852c30a?placeholderIfAbsent=true"
                  alt="User account"
                  className="w-5 h-5"
                />
                <span>{user ? 'My Account' : 'Sign In'}</span>
              </button>

              {/* Navigation Items */}
              {navigationItems.map((item, index) => (
                <Link
                  key={index}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center p-4 text-lg hover:bg-gray-50 rounded-lg transition-colors"
                >
                  {item.label}
                </Link>
              ))}

              {/* Language Selection */}
              <div className="relative">
                <button 
                  onClick={() => setIsLanguageDropdownOpen(!isLanguageDropdownOpen)}
                  className="flex items-center justify-between w-full p-4 text-lg hover:bg-gray-50 rounded-lg transition-colors text-left"
                >
                  <span>Language ({selectedLanguage})</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {isLanguageDropdownOpen && (
                  <div className="mt-2 bg-gray-50 border border-gray-200 rounded-lg overflow-hidden">
                    {languageOptions.map((option) => (
                      <button
                        key={option.code}
                        onClick={() => {
                          setSelectedLanguage(option.code);
                          setIsLanguageDropdownOpen(false);
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-gray-100 transition-colors"
                      >
                        {option.code} - {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      )}

      {/* Cart Sidebar */}
      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />

      {/* Search Popup */}
      <SearchPopup 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </>
  );
};
