// Imgur image upload utility
// Free anonymous uploads without API key
export const uploadToImgur = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        'Authorization': 'Client-ID a0f3e80f69328f2', // Public client ID for anonymous uploads
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload image to Imgur');
    }

    const data = await response.json();
    return data.data.link; // Returns the direct image URL
  } catch (error) {
    console.error('Imgur upload error:', error);
    throw error;
  }
};

// Upload multiple images
export const uploadMultipleToImgur = async (files: File[]): Promise<string[]> => {
  const uploadPromises = files.map(file => uploadToImgur(file));
  return Promise.all(uploadPromises);
};