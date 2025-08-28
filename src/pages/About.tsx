import React from 'react';
import { Header } from '@/components/Header';
import { CartSidebar } from '@/components/CartSidebar';
import { useState } from 'react';

const About = () => {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <div className="bg-white flex flex-col overflow-hidden">
      <Header />
      
      {/* Hero Section */}
      <div className="w-full max-w-4xl mx-auto px-8 max-md:px-4 pt-12">
        
        {/* Main Title */}
        <div className="text-center mb-16">
          <div className="w-24 h-px bg-[rgba(173,29,24,1)] mx-auto mb-8"></div>
          <p className="text-lg text-gray-700 leading-relaxed max-w-2xl mx-auto">
            In the remote mountains where tea grows naturally, artisan farmers dedicate their lives to 
            cultivating the perfect cup. We believe in single garden origins, where every leaf tells 
            the story of its terroir.
          </p>
        </div>

        {/* Founder's Story */}
        <div className="mb-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-normal text-black mb-6">Our Journey</h2>
              <p className="text-gray-700 leading-relaxed mb-6">
                Founded with a passion for authentic tea culture, our mission is to connect tea lovers 
                with the finest artisanal teas from around the world. We work directly with tea masters 
                and small-scale farmers who have perfected their craft over generations.
              </p>
              <p className="text-gray-700 leading-relaxed">
                Every tea in our collection is carefully selected for its unique character, sustainable 
                cultivation practices, and the story behind its creation.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="w-80 h-80 bg-gray-200 rounded-lg flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=400&h=400&fit=crop" 
                  alt="Tea plantation in mountains" 
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Philosophy Sections */}
        <div className="space-y-16 mb-20">
          
          {/* Section 1 - Loose Leaf Quality */}
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-normal text-black mb-4">The Art of Loose Leaf</h3>
              <p className="text-gray-700 leading-relaxed">
                We believe that loose leaf tea offers the purest expression of flavor and aroma. 
                Unlike processed tea bags, whole leaves unfurl naturally in hot water, releasing 
                their full complexity of taste and beneficial compounds. Each cup becomes a meditation, 
                a moment to pause and appreciate the subtle nuances that make great tea extraordinary.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=300&h=300&fit=crop" 
                  alt="Loose tea leaves" 
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Section 2 - Direct Sourcing */}
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="flex justify-center md:order-1">
              <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=300&fit=crop" 
                  alt="Tea farmer working" 
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>
            <div className="md:col-span-2 md:order-2">
              <h3 className="text-2xl font-normal text-black mb-4">Direct from Source</h3>
              <p className="text-gray-700 leading-relaxed">
                Our commitment to quality begins at the source. We work directly with tea growers, 
                eliminating intermediaries to ensure fair compensation for farmers and the freshest 
                product for our customers. This direct relationship allows us to understand each tea's 
                unique story and share it with you.
              </p>
            </div>
          </div>

          {/* Section 3 - Exploration */}
          <div className="grid md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <h3 className="text-2xl font-normal text-black mb-4">Continuous Discovery</h3>
              <p className="text-gray-700 leading-relaxed">
                The world of tea is vast and ever-changing. We continuously explore new regions, 
                discover emerging tea masters, and seek out rare varietals that represent the pinnacle 
                of their terroir. Our curiosity drives us to find teas that surprise, delight, and 
                educate even the most experienced tea connoisseurs.
              </p>
            </div>
            <div className="flex justify-center">
              <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                <img 
                  src="https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=300&h=300&fit=crop" 
                  alt="Tea ceremony" 
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="mb-20">
          <h2 className="text-3xl font-normal text-black text-center mb-12">Our Values</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl font-medium">Q</span>
              </div>
              <h3 className="text-xl font-medium text-black mb-3">Quality First</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                Every tea is rigorously tested and tasted to ensure it meets our exacting standards 
                for flavor, aroma, and purity.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl font-medium">S</span>
              </div>
              <h3 className="text-xl font-medium text-black mb-3">Sustainability</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                We support environmentally responsible farming practices and work with producers 
                who care for their land and communities.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-white text-2xl font-medium">T</span>
              </div>
              <h3 className="text-xl font-medium text-black mb-3">Transparency</h3>
              <p className="text-gray-600 text-sm leading-relaxed">
                We share the complete story of each tea - from garden to cup - so you know 
                exactly what you're drinking.
              </p>
            </div>
          </div>
        </div>

        {/* Closing Section */}
        <div className="text-center mb-20">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-normal text-black mb-6">Join Our Journey</h2>
            <p className="text-gray-700 leading-relaxed mb-8">
              Whether you're a tea novice or a seasoned connoisseur, we invite you to explore our 
              carefully curated collection. Each cup is an invitation to slow down, savor the moment, 
              and connect with centuries of tea tradition.
            </p>
            <div className="w-32 h-px bg-[rgba(173,29,24,1)] mx-auto"></div>
          </div>
        </div>
      </div>

      {/* Decorative Image Section */}
      <div className="w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] flex justify-center mb-16">
        <img
          src="https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=800&h=300&fit=crop"
          alt="Tea plantation landscape"
          className="w-full max-w-4xl h-64 object-cover"
        />
      </div>

      {/* Cart Sidebar */}
      <CartSidebar 
        isOpen={isCartOpen} 
        onClose={() => setIsCartOpen(false)} 
      />
    </div>
  );
};

export default About;