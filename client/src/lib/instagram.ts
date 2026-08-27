export function isInstagramVideoUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const isInstagramHost = url.protocol === "https:"
      && (url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com"));
    return isInstagramHost && (url.pathname.startsWith("/p/") || url.pathname.startsWith("/reel/"));
  } catch {
    return false;
  }
}
