import { Animal } from '../types';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function enrichAnimalDataWithAI(animals: Partial<Animal>[]) {
  const prompt = `
  請為以下動物提供繁體中文的特色說明、棲息地與食性。
  請回傳 JSON 格式，key 為學名 (scientificName)，value 為包含 characteristics, habitat, diet 的物件。
  如果找不到該動物的資料，請盡量根據其科屬推測或填寫「暫無資料」。
  動物列表：
  ${animals.map(a => a.scientificName).join('\n')}
  
  JSON 格式範例：
  {
    "Passer montanus": {
      "characteristics": "體型小巧，頭部呈栗褐色，臉頰有明顯黑斑。",
      "habitat": "都市、農田、鄉村",
      "diet": "雜食性，以種子、穀物與昆蟲為主"
    }
  }
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (e) {
    console.error("AI enrichment failed", e);
  }
  return {};
}

async function getBirdSound(scientificName: string) {
  try {
    const targetUrl = `https://xeno-canto.org/api/2/recordings?query=${encodeURIComponent(scientificName)}`;
    // Use a more reliable CORS proxy
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    const res = await fetch(proxyUrl);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    if (data.recordings && data.recordings.length > 0) {
      return data.recordings[0].file;
    }
  } catch (e) {
    console.warn("Failed to fetch sound for", scientificName, e);
  }
  return undefined;
}

export async function getNearbySpecies(lat: number, lng: number, page: number = 1, category: string = 'All'): Promise<Animal[]> {
  let taxa = 'Aves,Reptilia,Insecta,Arachnida';
  if (category === 'Birds') taxa = 'Aves';
  if (category === 'Insects') taxa = 'Insecta';
  if (category === 'Reptiles') taxa = 'Reptilia';
  if (category === 'Spiders') taxa = 'Arachnida';

  const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=5&iconic_taxa=${taxa}&locale=zh-TW&per_page=20&page=${page}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch data from iNaturalist');
    }
    
    const data = await response.json();

    const baseAnimals = data.results.map((result: any) => {
      const taxon = result.taxon;
      const count = result.count;
      
      // Determine rarity based on observation count in the area
      let rarity: 'Common' | 'Uncommon' | 'Rare' = 'Common';
      if (count < 5) rarity = 'Rare';
      else if (count < 15) rarity = 'Uncommon';

      return {
        id: taxon.id.toString(),
        name: taxon.preferred_common_name || taxon.name,
        scientificName: taxon.name,
        description: `在您附近被觀察到 ${count} 次。這是一筆來自 iNaturalist 的真實觀測紀錄。`,
        imageUrl: taxon.default_photo?.medium_url || 'https://images.unsplash.com/photo-1535083252446-faea5c0f651f?auto=format&fit=crop&q=80&w=800',
        habitat: '您的附近',
        rarity
      };
    });

    // Enrich with AI
    const aiData = await enrichAnimalDataWithAI(baseAnimals);

    // Fetch sounds concurrently
    const animalsWithSoundsAndAI = await Promise.all(baseAnimals.map(async (animal: any) => {
      const soundUrl = await getBirdSound(animal.scientificName);
      const enriched = aiData[animal.scientificName] || {};
      
      return {
        ...animal,
        soundUrl,
        characteristics: enriched.characteristics || '暫無資料',
        habitat: enriched.habitat || animal.habitat,
        diet: enriched.diet || '暫無資料',
      };
    }));

    return animalsWithSoundsAndAI;
  } catch (error) {
    console.error("Error fetching nearby species:", error);
    throw error;
  }
}
