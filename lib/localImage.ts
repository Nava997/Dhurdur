// Sample photos come from Unsplash. Loading them straight from
// images.unsplash.com would hand every visitor's IP address to a US company
// the privacy policy doesn't list, so they go through Next's image optimizer
// instead: the server fetches them once and the browser only talks to this
// site. Other URLs (Cloudinary uploads) are returned unchanged.
export function localImage(url: string | undefined, width = 1920): string {
  if (!url || !url.startsWith('https://images.unsplash.com/')) return url ?? '';
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=75`;
}
