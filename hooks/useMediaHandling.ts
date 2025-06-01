import { ClipboardEvent, Dispatch, SetStateAction } from 'react';

export const useMediaHandling = (
  setPastedImages: Dispatch<SetStateAction<string[]>>,
  setPastedUrls: Dispatch<SetStateAction<string[]>>
) => {
  // Handle paste event to capture rich content
  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    // Clear previous images and URLs to prevent accumulation
    setPastedImages([]);
    setPastedUrls([]);
    
    // Try to extract HTML content
    const html = e.clipboardData.getData('text/html');
    
    // Create temporary element to parse HTML content
    if (html) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      // Extract all links
      const links: string[] = [];
      const linkElements = tempDiv.querySelectorAll('a');
      linkElements.forEach(link => {
        if (link.href) links.push(link.href);
      });
      setPastedUrls(links);
      
      // Extract all images
      const images: string[] = [];
      const imageElements = tempDiv.querySelectorAll('img');
      imageElements.forEach(img => {
        if (img.src) {
          // Skip emoji images
          if (!img.src.includes('emoji') && img.src.length > 30) {
            images.push(img.src);
            console.log(`Found image from HTML: ${img.src.substring(0, 30)}...`);
          } else {
            console.log(`Skipping emoji image: ${img.src.substring(0, 30)}...`);
          }
        }
      });
      setPastedImages(images);
      
      console.log('Extracted from paste:', { links, images });
    }
    
    // Check for files (images) in the clipboard
    if (e.clipboardData.files && e.clipboardData.files.length > 0) {
      const imageFiles = Array.from(e.clipboardData.files).filter(file => 
        file.type.startsWith('image/')
      );
      
      if (imageFiles.length > 0) {
        console.log(`Found ${imageFiles.length} image files in clipboard`);
        
        // Convert image files to data URLs
        imageFiles.forEach(file => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target && event.target.result) {
              const dataUrl = event.target!.result as string;
              console.log(`Converted image to data URL: ${dataUrl.substring(0, 30)}...`);
              setPastedImages(prev => [...prev, dataUrl]);
            }
          };
          reader.readAsDataURL(file);
        });
      }
    }
  };

  return {
    handlePaste,
  };
}; 