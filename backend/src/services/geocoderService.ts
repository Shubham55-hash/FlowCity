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

    // Try Google Geocode API first if key is available
    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    if (googleKey && googleKey !== 'your_google_api_key_here') {
      try {
        const gRes = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
          params: {
            address: `${name}, Mumbai, India`,
            key: googleKey,
            region: 'in'
          },
          timeout: 3000,
        });

        if (gRes.data?.status === 'OK' && gRes.data?.results?.length > 0) {
          const loc = gRes.data.results[0].geometry.location;
          return { lat: loc.lat, lng: loc.lng };
        }
      } catch (error) {
        console.warn('Google Geocode failed:', (error as any)?.message || error);
      }
    }

    // Try Geoapify API fallback
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

  public async autocomplete(query: string, limit = 12): Promise<Array<{ name: string; lat: number; lng: number }>> {
    const normalized = query.toLowerCase().trim();
    if (!normalized) return [];

    // Station/autocomplete quality default pairs from local registry (last fallback)
    const localMatches = Object.entries(this.localRegistry)
      .filter(([key]) => key.includes(normalized))
      .slice(0, limit)
      .map(([key, coords]) => ({ name: key, lat: coords.lat, lng: coords.lng }));

    const googleKey = process.env.GOOGLE_MAPS_API_KEY;
    const placeResults: Array<{ name: string; lat: number; lng: number; type?: string }> = [];

    if (googleKey && googleKey !== 'your_google_api_key_here') {
      try {
        const autocompleteRes = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
          params: {
            input: query,
            key: googleKey,
            language: 'en',
            components: 'country:in',
            types: 'geocode',
            sessiontoken: `${Date.now()}`
          },
          timeout: 4000,
        });

        if (autocompleteRes.data?.status === 'OK' && Array.isArray(autocompleteRes.data.predictions)) {
          const preds = autocompleteRes.data.predictions.slice(0, limit * 2);
          for (const pred of preds) {
            try {
              const detailsRes = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
                params: {
                  place_id: pred.place_id,
                  key: googleKey,
                  fields: 'formatted_address,geometry,name',
                  language: 'en'
                },
                timeout: 4000,
              });

              const detail = detailsRes.data?.result;
              if (detail?.geometry?.location) {
                placeResults.push({
                  name: detail.formatted_address || detail.name || pred.description || pred.structured_formatting?.main_text || pred.description,
                  lat: detail.geometry.location.lat,
                  lng: detail.geometry.location.lng
                });
                if (placeResults.length >= limit) break;
              }
            } catch (_innerError) {
              // skip failures and continue
            }
          }
        }
      } catch (error) {
        console.warn('Google Places autocomplete failed:', (error as any)?.message || error);
      }
    }

    if (placeResults.length < limit) {
      const apiKey = process.env.GEOAPIFY_API_KEY;
      if (apiKey && apiKey !== 'your_geoapify_key_here') {
        try {
          const response = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
            params: {
              text: query,
              limit: limit - placeResults.length,
              lang: 'en',
              format: 'json',
              apiKey,
            },
            timeout: 4000,
          });

          const features = response.data?.features || [];
          for (const feature of features) {
            if (feature.properties?.formatted && feature.geometry?.coordinates?.length === 2) {
              placeResults.push({
                name: feature.properties.formatted,
                lat: feature.geometry.coordinates[1],
                lng: feature.geometry.coordinates[0],
              });
              if (placeResults.length >= limit) break;
            }
          }
        } catch (error) {
          console.warn('Geoapify autocomplete error:', (error as any)?.message || error);
        }
      }
    }

    if (placeResults.length < limit) {
      try {
        const nominatim = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: query,
            format: 'json',
            addressdetails: 0,
            limit: limit - placeResults.length,
            countrycodes: 'in',
          },
          headers: { 'User-Agent': 'FlowCity/1.0' },
          timeout: 4000,
        });

        const results = nominatim.data || [];
        for (const item of results) {
          if (item.display_name && item.lat && item.lon) {
            placeResults.push({
              name: item.display_name,
              lat: parseFloat(item.lat),
              lng: parseFloat(item.lon),
            });
            if (placeResults.length >= limit) break;
          }
        }
      } catch (error) {
        console.warn('Nominatim autocomplete error:', (error as any)?.message || error);
      }
    }

    const merged = [...placeResults, ...localMatches];
    const unique = merged.filter((item, index, arr) => arr.findIndex(x => x.name === item.name && x.lat === item.lat && x.lng === item.lng) === index);
    return unique.slice(0, limit);
  }
}

export const geocoderService = new GeocoderService();
