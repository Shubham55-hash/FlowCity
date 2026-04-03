import axios from 'axios';

export interface Coordinates {
  lat: number;
  lng: number;
}

class GeocoderService {

  // Local registry for high-priority Mumbai locations to ensure 100% reliability
  private readonly localRegistry: Record<string, Coordinates> = {
    'borivali': { lat: 19.2291, lng: 72.8574 },
    'andheri': { lat: 19.1197, lng: 72.8468 },
    'virar': { lat: 19.4544, lng: 72.7997 },
    'vasai': { lat: 19.3792, lng: 72.8154 },
    'nala sopara': { lat: 19.4168, lng: 72.8122 },
    'bhayandar': { lat: 19.2906, lng: 72.8542 },
    'mira road': { lat: 19.2817, lng: 72.8557 },
    'churchgate': { lat: 18.9353, lng: 72.8258 },
    'csmt': { lat: 18.9400, lng: 72.8353 },
    'dadar': { lat: 19.0178, lng: 72.8478 },
    'bandra': { lat: 19.0522, lng: 72.8414 },
    'bkc': { lat: 19.0607, lng: 72.8636 },
    'kurla': { lat: 19.0635, lng: 72.8876 },
    'ghatkopar': { lat: 19.0860, lng: 72.9090 },
    'vashi': { lat: 19.0645, lng: 73.0011 },
    'thane': { lat: 19.1860, lng: 72.9480 },
    'belapur': { lat: 19.0189, lng: 73.0387 },
    'kalyan': { lat: 19.2361, lng: 73.1306 },
    'dombivli': { lat: 19.2184, lng: 73.0867 },
    'panvel': { lat: 18.9894, lng: 73.1175 },
  };

  public async geocode(name: string): Promise<Coordinates | null> {
    const normalized = name.toLowerCase().trim();
    
    // Check local registry first
    if (this.localRegistry[normalized]) {
      return this.localRegistry[normalized];
    }

    // Try Geoapify API
    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey || apiKey === 'your_geoapify_key_here') {
      console.warn('Geoapify API key missing, falling back to null');
      return null;
    }

    try {
      const response = await axios.get('https://api.geoapify.com/v1/geocode/search', {
        params: {
          text: `${name}, Mumbai, India`,
          apiKey: apiKey,
        },
        timeout: 3000,
      });

      const feature = response.data?.features?.[0];
      if (feature) {
        const [lng, lat] = feature.geometry.coordinates;
        return { lat, lng };
      }
    } catch (error) {
      console.error(`Geocoding error for ${name}:`, error);
    }

    return null;
  }
}

export const geocoderService = new GeocoderService();
