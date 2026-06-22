export interface ResolvedPlace {
  name: string;
  lat: number;
  lng: number;
}

export function googleMapsUrl(lat: string | number, lng: string | number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function parseCoordinatesFromText(text: string): ResolvedPlace | null {
  const input = text.trim();
  if (!input) return null;

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&]ll=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = input.match(pattern);
    if (!match) continue;

    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { name: '地圖座標', lat, lng };
    }
  }

  return null;
}

export async function geocodePlaceName(placeName: string): Promise<ResolvedPlace | null> {
  const query = placeName.trim();
  if (!query) return null;

  const coordinates = parseCoordinatesFromText(query);
  if (coordinates) return coordinates;

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&accept-language=zh-TW`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Failed to geocode place');
  }

  const results = await response.json();
  const first = results?.[0];
  if (!first) return null;

  return {
    name: first.display_name || query,
    lat: Number(first.lat),
    lng: Number(first.lon),
  };
}

export async function getBrowserLocation(): Promise<ResolvedPlace> {
  if (!('geolocation' in navigator)) {
    throw new Error('Geolocation is not supported');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      position => {
        resolve({
          name: '目前位置',
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      reject,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}
