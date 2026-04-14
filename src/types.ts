export interface Animal {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  imageUrl: string;
  habitat: string;
  rarity: 'Common' | 'Uncommon' | 'Rare';
  characteristics?: string;
  diet?: string;
  category?: string;
  lat?: number;
  lng?: number;
}
