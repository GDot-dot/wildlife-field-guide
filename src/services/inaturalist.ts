import { Animal } from '../types';
import { GoogleGenAI } from '@google/genai';

const AI_PROXY_URL = process.env.VITE_AI_PROXY_URL || '';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

interface AIRecognitionResult {
  error?: string;
  name?: string;
  scientificName?: string;
  category?: string;
  rarity?: Animal['rarity'];
  description?: string;
  habitat?: string;
  characteristics?: string;
  diet?: string;
}

async function callAIProxy<T>(action: 'recognize' | 'enrich' | 'refine', payload: Record<string, unknown>): Promise<T | null> {
  if (!AI_PROXY_URL) return null;

  const response = await fetch(AI_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  });

  if (!response.ok) {
    throw new Error(`AI proxy failed with ${response.status}`);
  }

  return response.json();
}

const parseJsonResponse = (text?: string) => {
  if (!text) return null;
  return JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
};

const recognitionPrompt = `
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

const buildEnrichmentPrompt = (animals: Partial<Animal>[]) => `
請為以下生物(動物或植物)提供繁體中文的特色說明、棲息地與食性(若是植物請填寫生長環境或特徵)。
請回傳 JSON 格式，key 為學名 (scientificName)，value 為包含 characteristics, habitat, diet 的物件。
如果找不到該物種的資料，請盡量根據其科屬推測或填寫「暫無資料」。
物種列表：
${animals.map(a => a.scientificName).join('\n')}
`;

const buildNameRefinementPrompt = (name: string, scientificName?: string) => `
使用者已查證並修正物種名稱，請以這個名稱為準，重新整理更正確的繁體中文物種資料。

中文名稱：${name}
學名：${scientificName || '未知，請盡量查證或推測'}

請只回傳 JSON，包含以下欄位：
- name: 確認後的中文俗名
- scientificName: 正確學名，若無法確認請保留空字串
- category: Birds, Insects, Reptiles, Spiders, Flowers, Trees, Other 之一
- rarity: Common, Uncommon, Rare, Epic, Legendary 之一，依台灣常見程度推測
- description: 50 字內的自然觀察摘要，不要寫「被觀察到幾次」
- characteristics: 外觀、行為或辨識特色，繁體中文
- diet: 食性；若為植物請填生長環境或辨識特徵
- habitat: 棲地或生長環境

如果名稱太模糊無法判斷，請回傳 { "error": "名稱不足，無法補正物種資料" }。
`;

export async function recognizeImageWithAI(imageUrlOrBase64: string): Promise<AIRecognitionResult | null> {
  let mimeType = 'image/jpeg';
  let base64Data = imageUrlOrBase64;

  if (imageUrlOrBase64.startsWith('data:')) {
    const parts = imageUrlOrBase64.split(',');
    if (parts.length === 2) {
      const match = parts[0].match(/data:(image\/[^;]+);base64/);
      if (match) {
        mimeType = match[1];
      }
      base64Data = parts[1];
    }
  } else if (imageUrlOrBase64.startsWith('http')) {
    try {
      const response = await fetch(imageUrlOrBase64);
      const blob = await response.blob();
      mimeType = blob.type;
      base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Failed to fetch image URL", e);
      throw new Error("無法讀取圖片網址，這可能是因為跨域限制 (CORS)。請嘗試直接「上傳照片」來進行 AI 辨識。");
    }
  }

  try {
    if (AI_PROXY_URL) {
      const result = await callAIProxy<AIRecognitionResult>('recognize', { imageBase64: base64Data, mimeType });
      return result || { error: 'AI 辨識服務沒有回傳結果。' };
    }

    if (!ai) {
      return { error: 'AI 辨識尚未設定 GEMINI_API_KEY。' };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: recognitionPrompt },
          {
            inlineData: {
              data: base64Data,
              mimeType
            }
          }
        ]
      },
      config: {
        responseMimeType: 'application/json',
      }
    });

    return parseJsonResponse(response.text);
  } catch (e) {
    console.error("AI recognition failed", e);
    throw new Error("AI 辨識失敗或額度已滿");
  }
  return null;
}

async function enrichAnimalDataWithAI(animals: Partial<Animal>[]) {
  if (animals.length === 0) return {};

  try {
    if (AI_PROXY_URL) {
      return await callAIProxy('enrich', { species: animals.map(a => a.scientificName).filter(Boolean) }) || {};
    }

    if (!ai) return {};

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildEnrichmentPrompt(animals),
      config: {
        responseMimeType: 'application/json',
      }
    });

    return parseJsonResponse(response.text) || {};
  } catch (e) {
    console.error("AI enrichment failed", e);
  }
  return {};
}

export async function refineSpeciesByNameWithAI(name: string, scientificName?: string): Promise<AIRecognitionResult | null> {
  const trimmedName = name.trim();
  const trimmedScientificName = scientificName?.trim();

  if (!trimmedName && !trimmedScientificName) {
    return { error: '請先輸入中文名稱或學名。' };
  }

  try {
    if (AI_PROXY_URL) {
      return await callAIProxy<AIRecognitionResult>('refine', { name: trimmedName, scientificName: trimmedScientificName }) ||
        { error: 'AI 補正服務沒有回傳結果。' };
    }

    if (!ai) {
      return { error: 'AI 補正尚未設定 GEMINI_API_KEY。' };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: buildNameRefinementPrompt(trimmedName, trimmedScientificName),
      config: {
        responseMimeType: 'application/json',
      }
    });

    return parseJsonResponse(response.text);
  } catch (e) {
    console.error("AI name refinement failed", e);
    throw new Error("AI 補正失敗或額度已滿");
  }
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
      let rarity: Animal['rarity'] = 'Common';
      if (count <= 1) rarity = 'Legendary';
      else if (count <= 3) rarity = 'Epic';
      else if (count < 8) rarity = 'Rare';
      else if (count < 20) rarity = 'Uncommon';

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
