// Utility to convert images to base64 and store them directly in database
export const convertImageToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      resolve(reader.result as string);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const isBase64Image = (str: string): boolean => {
  return str.startsWith('data:image/');
};

export const getImageUrl = (imageData: string, fallbackUrl?: string): string => {
  // If it's already a base64 image, return it
  if (isBase64Image(imageData)) {
    return imageData;
  }
  
  // If it's a full URL (http/https), return it
  if (imageData.startsWith('http://') || imageData.startsWith('https://')) {
    return imageData;
  }
  
  // Otherwise return fallback
  return fallbackUrl || 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop';
};