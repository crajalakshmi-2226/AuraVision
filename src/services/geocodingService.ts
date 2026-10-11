/**
 * AuraVision AI - Open Geocoding & Coordinate Resolver Service
 * Powered by OpenStreetMap Nominatim (Free, unmetered, no paid API keys required)
 * Includes coordinate parser and curated presets for offline fallback.
 */

export interface GeocodingResult {
  displayName: string;
  lat: number;
  lng: number;
  type?: string;
  importance?: number;
}

export const PRESET_LOCATIONS: GeocodingResult[] = [
  {
    displayName: 'San Francisco Financial District, CA, USA',
    lat: 37.7749,
    lng: -122.4194,
    type: 'metropolitan',
  },
  {
    displayName: 'New York City Manhattan Hub, NY, USA',
    lat: 40.7128,
    lng: -74.006,
    type: 'metropolitan',
  },
  {
    displayName: 'London Westminster & River Thames, UK',
    lat: 51.5074,
    lng: -0.1278,
    type: 'capital',
  },
  {
    displayName: 'Tokyo Shibuya Crossing & Shinjuku, Japan',
    lat: 35.6762,
    lng: 139.6503,
    type: 'capital',
  },
  {
    displayName: 'Paris Eiffel Tower & Seine Sector, France',
    lat: 48.8566,
    lng: 2.3522,
    type: 'capital',
  },
  {
    displayName: 'Sydney Harbour & Opera House, Australia',
    lat: -33.8688,
    lng: 151.2093,
    type: 'coastal',
  },
  {
    displayName: 'Dubai Downtown Burj Khalifa Sector, UAE',
    lat: 25.2048,
    lng: 55.2708,
    type: 'skyline',
  },
];

/**
 * Parses raw text input for latitude/longitude coordinate pairs
 * Examples: "37.7749, -122.4194" or "37.7749 -122.4194"
 */
export function parseCoordinates(input: string): { lat: number; lng: number } | null {
  const trimmed = input.trim();
  const coordRegex = /^\s*([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)\s*$/;
  const match = trimmed.match(coordRegex);

  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Searches places, addresses, cities, or landmarks via OpenStreetMap Nominatim
 */
export async function searchLocations(query: string): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Check if input is direct numerical coordinates
  const parsed = parseCoordinates(trimmed);
  if (parsed) {
    return [
      {
        displayName: `Coordinates: ${parsed.lat.toFixed(5)}, ${parsed.lng.toFixed(5)}`,
        lat: parsed.lat,
        lng: parsed.lng,
        type: 'coordinate_pin',
      },
    ];
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        trimmed
      )}&limit=6&addressdetails=1`,
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'AuraVision-AI-Satellite-Pilot/1.0',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim HTTP error: ${response.status}`);
    }

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map((item: any) => ({
        displayName: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || item.class || 'location',
        importance: item.importance || 0,
      }));
    }
  } catch (err) {
    console.warn('Nominatim network lookup failed, falling back to local preset match:', err);
  }

  // Fallback to local matching presets if offline or network limited
  const qLower = trimmed.toLowerCase();
  const matchedPresets = PRESET_LOCATIONS.filter((p) =>
    p.displayName.toLowerCase().includes(qLower)
  );

  return matchedPresets;
}
