/**
 * Validates if an image URL is likely to work with Slack
 * @param url The image URL to validate
 * @returns boolean indicating if the URL is valid for Slack
 */
export function validateImageUrl(url: string | null): boolean {
  if (!url) return false;
  
  // Data URLs are valid - our Slack service can handle them by converting to buffers
  if (url.startsWith('data:image/')) {
    console.log('Valid data URL image detected');
    return true;
  }
  
  // Check for common image extensions
  const validExtensions = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
  
  // Check for URLs that Slack can access (public URLs)
  const validDomains = [
    'imgur.com', 'ibb.co', 'postimg.cc', 
    'cloudinary.com', 'res.cloudinary.com',
    'unsplash.com', 'images.unsplash.com',
    'media.giphy.com', 'giphy.com',
    'pbs.twimg.com',
    'githubusercontent.com',
    'beehiiv.com', 'googleusercontent.com',
    'lh3.googleusercontent.com', 'lh4.googleusercontent.com',
    'lh5.googleusercontent.com', 'lh6.googleusercontent.com',
    'ci3.googleusercontent.com', 'ci4.googleusercontent.com',
    'storage.googleapis.com'
  ];
  
  // Reject local URLs and other problematic formats (but allow data URLs)
  if (
    url.includes('localhost') || 
    url.includes('127.0.0.1') ||
    url.startsWith('file:') ||
    url.includes('emoji') ||
    (!url.startsWith('http') && !url.startsWith('data:'))
  ) {
    console.log(`Image URL validation failed - invalid format: ${url}`);
    return false;
  }
  
  // For HTTP URLs, check if it has a valid extension or comes from a known image domain
  if (url.startsWith('http')) {
    const hasValidExtension = validExtensions.test(url);
    const isFromValidDomain = validDomains.some(domain => url.includes(domain));
    
    if (!hasValidExtension && !isFromValidDomain) {
      console.log(`Image URL validation failed - not recognized as image: ${url}`);
      return false;
    }
  }
  
  return true;
} 