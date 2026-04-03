const SCRIPT_ID = 'flowcity-google-maps-js';

/** Resolves when the Maps JavaScript API is available on window.google.maps */
export function loadGoogleMaps(apiKey: string): Promise<void> {
  if (!apiKey) {
    return Promise.reject(new Error('Missing Google Maps API key'));
  }
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('No window'));
  }
  const g = window as Window & { google?: { maps: unknown } };
  if (g.google?.maps) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const done = () => {
        if ((window as Window & { google?: { maps: unknown } }).google?.maps) resolve();
        else reject(new Error('Google Maps failed to load'));
      };
      if ((window as Window & { google?: { maps: unknown } }).google?.maps) {
        resolve();
        return;
      }
      existing.addEventListener('load', done);
      existing.addEventListener('error', () => reject(new Error('Google Maps script error')));
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=geometry`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google Maps script error'));
    document.head.appendChild(script);
  });
}
