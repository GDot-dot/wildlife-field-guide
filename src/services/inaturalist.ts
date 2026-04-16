import { Animal } from '../types';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function recognizeImageWithAI(base64Image: string) {
  const match = base64Image.match(/^data:(image\/[a-z]+);base64,(.+)$/);
  let mimeType = 'image/jpeg';
  let base64Data = base64Image;

  if (match) {
    mimeType = match[1];
    base64Data = match[2];
  }

  const prompt = `
  請辨識這張圖片中的生物（動物或植物）。
  請回傳 JSON 格式，包含以下欄位：
  - name: 生物的中文俗名
  - scientificName: 學名
  - category: 分類，必須是以下之一：Birds, Insects, Reptiles, Spiders, Flowers, Trees, Other
  - rarity: 稀有度，必須是以下之一：Common, Uncommon, Rare, Epic, Legendary (請根據該物種在台灣的常見程度推測)
  - description: 關於這個生物的特色描述與觀察筆記 (約50字)
  - habitat: 棲息地描述

  如果圖片中沒有生物，或者無法辨識，請回傳 { "error": "無法辨識圖片中的生物" }。
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
  } catch (e) {
    console.error("AI recognition failed", e);
    throw new Error("AI 辨識失敗或額度已滿");
  }
  return null;
}

async function enrichAnimalDataWithAI(animals: Partial<Animal>[]) {
  if (animals.length === 0) return {};

  const prompt = `
  請為以下生物(動物或植物)提供繁體中文的特色說明、棲息地與食性(若是植物請填寫生長環境或特徵)。
  請回傳 JSON 格式，key 為學名 (scientificName)，value 為包含 characteristics, habitat, diet 的物件。
  如果找不到該物種的資料，請盡量根據其科屬推測或填寫「暫無資料」。
  物種列表：
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

export async function getNearbySpecies(lat: number, lng: number, page: number = 1, category: string = 'All', radius: number = 5): Promise<Animal[]> {
  let taxa = 'Aves,Reptilia,Insecta,Arachnida,Plantae';
  let taxonIdParam = '';
  
  if (category === 'Birds') taxa = 'Aves';
  else if (category === 'Insects') taxa = 'Insecta';
  else if (category === 'Reptiles') taxa = 'Reptilia';
  else if (category === 'Spiders') taxa = 'Arachnida';
  else if (category === 'Flowers') { taxa = ''; taxonIdParam = '&taxon_id=47125'; } // 被子植物 (Angiospermae)
  else if (category === 'Trees') { taxa = ''; taxonIdParam = '&taxon_id=47126'; } // 植物界 (Plantae)

  const taxaParam = taxa ? `&iconic_taxa=${taxa}` : '';
  const url = `https://api.inaturalist.org/v1/observations/species_counts?lat=${lat}&lng=${lng}&radius=${radius}${taxaParam}${taxonIdParam}&locale=zh-TW&per_page=20&page=${page}`;
  
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

      // Map iconic_taxon_name to category
      let animalCategory = 'Other';
      if (taxon.iconic_taxon_name === 'Aves') animalCategory = 'Birds';
      else if (taxon.iconic_taxon_name === 'Insecta') animalCategory = 'Insects';
      else if (taxon.iconic_taxon_name === 'Reptilia') animalCategory = 'Reptiles';
      else if (taxon.iconic_taxon_name === 'Arachnida') animalCategory = 'Spiders';
      else if (taxon.iconic_taxon_name === 'Plantae') animalCategory = 'Plants';

      return {
        id: taxon.id.toString(),
        name: taxon.preferred_common_name || taxon.name,
        scientificName: taxon.name,
        description: `在您附近被觀察到 ${count} 次。這是一筆來自 iNaturalist 的真實觀測紀錄。`,
        imageUrl: taxon.default_photo?.medium_url || 'https://images.unsplash.com/photo-1535083252446-faea5c0f651f?auto=format&fit=crop&q=80&w=800',
        habitat: '您的附近',
        rarity,
        category: animalCategory
      };
    });

    const CACHE_PREFIX = 'wildlife_cache_v2_';
    const uncachedAnimals: any[] = [];
    const cachedData: Record<string, any> = {};

    baseAnimals.forEach((animal: any) => {
      const cached = localStorage.getItem(CACHE_PREFIX + animal.scientificName);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const actualData = parsed.data || parsed;
          const timestamp = parsed.timestamp || 0;
          
          // 快取過期時間：30天 (30 * 24 * 60 * 60 * 1000 毫秒)
          const isExpired = (Date.now() - timestamp) > 2592000000;
          // 如果之前 AI 找不到資料 (暫無資料)，也視為無效快取，重新詢問
          const isNoData = actualData.characteristics === '暫無資料' || actualData.characteristics === '';

          if (isExpired || isNoData) {
            uncachedAnimals.push(animal);
          } else {
            cachedData[animal.scientificName] = actualData;
          }
        } catch (e) {
          uncachedAnimals.push(animal);
        }
      } else {
        uncachedAnimals.push(animal);
      }
    });

    // Enrich with AI only for uncached
    let aiData: Record<string, any> = {};
    if (uncachedAnimals.length > 0) {
      aiData = await enrichAnimalDataWithAI(uncachedAnimals);
    }

    // Fetch sounds concurrently for uncached
    const animalsWithSoundsAndAI = await Promise.all(baseAnimals.map(async (animal: any) => {
      if (cachedData[animal.scientificName]) {
        return {
          ...animal,
          ...cachedData[animal.scientificName]
        };
      }
      
      const enriched = aiData[animal.scientificName] || {};
      
      const additionalData = {
        characteristics: enriched.characteristics || '暫無資料',
        habitat: enriched.habitat || animal.habitat,
        diet: enriched.diet || '暫無資料',
      };

      // 存入快取 (加入時間戳記)
      localStorage.setItem(CACHE_PREFIX + animal.scientificName, JSON.stringify({
        data: additionalData,
        timestamp: Date.now()
      }));

      return {
        ...animal,
        ...additionalData
      };
    }));

    return animalsWithSoundsAndAI;
  } catch (error) {
    console.error("Error fetching nearby species:", error);
    throw error;
  }
}
