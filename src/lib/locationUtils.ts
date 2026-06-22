export interface ResolvedPlace {
  name: string;
  lat: number;
  lng: number;
}

export async function geocodePlaceName(placeName: string): Promise<ResolvedPlace | null> {
  const query = placeName.trim();
  if (!query) return null;

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
