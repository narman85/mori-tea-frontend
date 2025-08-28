import React from 'react';

interface HeroProps {
  className?: string;
}

export const Hero: React.FC<HeroProps> = ({ className = '' }) => {
  return (
    <section className={`flex flex-col items-center ${className}`}>
      <h1 className="text-black text-6xl font-normal leading-[80px] text-center mt-[60px] max-md:text-[40px] max-md:leading-[59px] max-md:mt-6">
        Sip the silence
        <br />
        Japan in a cup
      </h1>
      
      <img
        src="https://api.builder.io/api/v1/image/assets/TEMP/f4646c48a87e2fa35b1793686a774f13e6cc12f2?placeholderIfAbsent=true"
        alt="Japanese tea ceremony scene"
        className="aspect-[1.8] object-contain w-full max-w-[800px] mt-[30px] max-md:max-w-full max-md:mt-6"
      />
    </section>
  );
};
