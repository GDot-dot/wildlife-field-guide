export interface Animal {
  id: string;
  name: string;
  scientificName: string;
  description: string;
  imageUrl: string;
  habitat: string;
  rarity: 'Common' | 'Uncommon' | 'Rare';
  soundUrl?: string;
  characteristics?: string;
  diet?: string;
}
