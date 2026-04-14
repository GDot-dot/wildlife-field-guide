import React, { useState, useEffect } from 'react';
import { AnimalCard } from '../components/AnimalCard';
import { SkeletonCard } from '../components/SkeletonCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';
import { getNearbySpecies } from '../services/inaturalist';
import { Animal } from '../types';
import { MapPin, Loader2, AlertCircle, Filter, Plus, X, EyeOff, Upload } from 'lucide-react';

const CATEGORIES = [
  { id: 'All', label: '全部' },
  { id: 'Birds', label: '鳥類' },
  { id: 'Insects', label: '昆蟲' },
  { id: 'Reptiles', label: '爬蟲類' },
  { id: 'Spiders', label: '蜘蛛' },
  { id: 'Flowers', label: '花' },
  { id: 'Trees', label: '樹木' }
];

export function ExplorePage() {
  const { user } = useAuth();
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState('All');
  const [radius, setRadius] = useState(5);
  const [currentLocation, setCurrentLocation] = useState<{lat: number, lng: number} | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Filters
  const [showUncollectedOnly, setShowUncollectedOnly] = useState(false);
  const [rarityFilter, setRarityFilter] = useState<string>('All');

  // Custom Discovery Modal
  const [isCustomModalOpen, setIsCustomModalOpen] = useState(false);
  const [customAnimal, setCustomAnimal] = useState<Partial<Animal>>({
    name: '',
    scientificName: '',
    description: '',
    imageUrl: '',
    habitat: '',
    category: 'Other',
    rarity: 'Common'
  });

  useEffect(() => {
    if (!user) {
      setCollectedIds(new Set());
      return;
    }

    const q = query(collection(db, 'user_collections'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set<string>();
      snapshot.forEach((doc) => {
        ids.add(doc.data().animalId);
      });
      setCollectedIds(ids);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_collections');
    });

    return () => unsubscribe();
  }, [user]);

  const fetchSpecies = async (lat: number, lng: number, targetPage: number, targetCategory: string, targetRadius: number, append: boolean = false) => {
    try {
      const nearbyAnimals = await getNearbySpecies(lat, lng, targetPage, targetCategory, targetRadius);
      if (append) {
        setAnimals(prev => [...prev, ...nearbyAnimals]);
      } else {
        setAnimals(nearbyAnimals);
      }
      setHasMore(nearbyAnimals.length === 20); // 如果回傳數量等於 per_page，代表可能還有下一頁
    } catch (error) {
      console.error(error);
      setLocationError('無法取得附近的生物資料，請稍後再試');
    }
  };

  const handleGetLocation = () => {
    setLoadingLocation(true);
    setLocationError(null);
    setPage(1);
    setHasMore(true);

    if (!('geolocation' in navigator)) {
      setLocationError('您的瀏覽器不支援定位功能');
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        setCurrentLocation({ lat: latitude, lng: longitude });
        setLocationName(null);

        // Reverse geocoding to get location name
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=14&accept-language=zh-TW`);
          const data = await res.json();
          if (data && data.address) {
            const addr = data.address;
            const city = addr.city || addr.county || '';
            const district = addr.town || addr.village || addr.suburb || addr.district || '';
            const name = `${city}${district}` || data.display_name;
            setLocationName(name);
          }
        } catch (e) {
          console.error("Reverse geocoding failed", e);
        }

        await fetchSpecies(latitude, longitude, 1, category, radius, false);
        setLoadingLocation(false);
      },
      (error) => {
        console.error(error);
        setLocationError('無法取得位置資訊，請確認是否允許定位權限');
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleLoadMore = async () => {
    if (!currentLocation || loadingMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchSpecies(currentLocation.lat, currentLocation.lng, nextPage, category, radius, true);
    setLoadingMore(false);
  };

  const handleCategoryChange = async (newCategory: string) => {
    setCategory(newCategory);
    if (currentLocation) {
      setLoadingLocation(true);
      setPage(1);
      setHasMore(true);
      await fetchSpecies(currentLocation.lat, currentLocation.lng, 1, newCategory, radius, false);
      setLoadingLocation(false);
    }
  };

  const handleRadiusChange = async (newRadius: number) => {
    setRadius(newRadius);
    if (currentLocation) {
      setLoadingLocation(true);
      setPage(1);
      setHasMore(true);
      await fetchSpecies(currentLocation.lat, currentLocation.lng, 1, category, newRadius, false);
      setLoadingLocation(false);
    }
  };

  const handleCollect = async (animal: Animal) => {
    if (!user) {
      alert('請先登入才能蒐集圖鑑喔！');
      return;
    }

    try {
      const recordId = `${user.uid}_${animal.id}`;
      const dataToSave: any = {
        userId: user.uid,
        animalId: String(animal.id),
        animalName: animal.name || '',
        animalImageUrl: animal.imageUrl || '',
        description: animal.description || '',
        habitat: animal.habitat || '',
        category: animal.category || 'Other',
        lat: currentLocation?.lat ?? null,
        lng: currentLocation?.lng ?? null,
        collectedAt: serverTimestamp()
      };
      
      if (animal.characteristics) dataToSave.characteristics = String(animal.characteristics);
      if (animal.diet) dataToSave.diet = String(animal.diet);

      await setDoc(doc(db, 'user_collections', recordId), dataToSave);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `user_collections/${user.uid}_${animal.id}`);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_SIZE = 800;

        if (width > height) {
          if (width > MAX_SIZE) {
            height *= MAX_SIZE / width;
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width *= MAX_SIZE / height;
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setCustomAnimal({ ...customAnimal, imageUrl: compressedBase64 });
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCustom = async () => {
    if (!user) {
      alert('請先登入才能新增自訂發現喔！');
      return;
    }
    if (!customAnimal.name || !customAnimal.imageUrl) {
      alert('請填寫生物名稱與圖片網址！');
      return;
    }

    try {
      const customId = `custom_${Date.now()}`;
      const recordId = `${user.uid}_${customId}`;
      const dataToSave: any = {
        userId: user.uid,
        animalId: customId,
        animalName: customAnimal.name,
        animalScientificName: customAnimal.scientificName || '',
        animalImageUrl: customAnimal.imageUrl,
        description: customAnimal.description || '',
        habitat: customAnimal.habitat || '',
        category: customAnimal.category || 'Other',
        rarity: customAnimal.rarity || 'Common',
        lat: currentLocation?.lat ?? null,
        lng: currentLocation?.lng ?? null,
        collectedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'user_collections', recordId), dataToSave);
      setIsCustomModalOpen(false);
      setCustomAnimal({
        name: '', scientificName: '', description: '', imageUrl: '', habitat: '', category: 'Other', rarity: 'Common'
      });
      alert('成功新增自訂發現！');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `user_collections/custom`);
    }
  };

  const filteredAnimals = animals.filter(animal => {
    if (showUncollectedOnly && collectedIds.has(animal.id)) return false;
    if (rarityFilter !== 'All' && animal.rarity !== rarityFilter) return false;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">探索地區生物</h1>
          <p className="text-gray-600">
            讀取您的 GPS 定位，尋找附近出沒的鳥類、昆蟲與爬蟲類。
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsCustomModalOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2 bg-white border border-green-600 text-green-600 rounded-xl hover:bg-green-50 transition-colors font-medium"
          >
            <Plus className="w-5 h-5 mr-2" />
            自訂發現
          </button>
          <button
            onClick={handleGetLocation}
            disabled={loadingLocation}
            className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loadingLocation ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <MapPin className="w-5 h-5 mr-2" />
            )}
            {loadingLocation ? '正在尋找...' : '尋找附近生物'}
          </button>
        </div>
      </div>

      {currentLocation && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex flex-col gap-4">
          <div className="flex items-center text-green-700 bg-green-50 px-3 py-2 rounded-lg w-fit">
            <MapPin className="w-5 h-5 mr-2" />
            <span className="text-sm font-bold">
              {locationName ? `目前位置：${locationName}` : '已取得定位，正在解析地址...'}
            </span>
          </div>
          
          <div className="flex flex-col gap-4 border-t border-gray-100 pt-4">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center text-gray-500 mr-2">
                  <Filter className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">分類：</span>
                </div>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      category === cat.id 
                        ? 'bg-green-100 text-green-800 border border-green-200' 
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-2 items-center border-t sm:border-t-0 sm:border-l border-gray-100 pt-3 sm:pt-0 sm:pl-4">
                <div className="flex items-center text-gray-500 mr-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="text-sm font-medium">範圍：</span>
                </div>
                {[2, 5].map(r => (
                  <button
                    key={r}
                    onClick={() => handleRadiusChange(r)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      radius === r 
                        ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                        : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {r} 公里
                  </button>
                ))}
              </div>
            </div>

            {/* 進階篩選 */}
            <div className="flex flex-wrap gap-4 items-center border-t border-gray-100 pt-4">
              <button
                onClick={() => setShowUncollectedOnly(!showUncollectedOnly)}
                className={`inline-flex items-center px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  showUncollectedOnly 
                    ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' 
                    : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                <EyeOff className="w-4 h-4 mr-1.5" />
                只顯示未蒐集
              </button>

              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-500">稀有度：</span>
                {['All', 'Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'].map(r => (
                  <button
                    key={r}
                    onClick={() => setRarityFilter(r)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      rarityFilter === r 
                        ? 'bg-gray-800 text-white' 
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {r === 'All' ? '全部' : 
                     r === 'Common' ? '常見' : 
                     r === 'Uncommon' ? '少見' : 
                     r === 'Rare' ? '稀有' : 
                     r === 'Epic' ? '史詩' : '傳說'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {locationError && (
        <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{locationError}</p>
        </div>
      )}

      {loadingLocation ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : animals.length === 0 && !locationError ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
          <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <MapPin className="w-8 h-8 text-green-500" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">點擊按鈕開始探索</h3>
          <p className="text-gray-500">我們將使用 iNaturalist API 尋找您附近的真實觀測紀錄</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAnimals.map((animal, index) => (
              <AnimalCard
                key={`${animal.id}-${index}`}
                animal={animal}
                isCollected={collectedIds.has(animal.id)}
                onCollect={handleCollect}
              />
            ))}
          </div>
          
          {filteredAnimals.length === 0 && animals.length > 0 && (
            <div className="text-center py-12 text-gray-500">
              沒有符合篩選條件的生物。
            </div>
          )}
          
          {animals.length > 0 && hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="inline-flex items-center px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin text-gray-400" />
                    載入中...
                  </>
                ) : (
                  '載入更多'
                )}
              </button>
            </div>
          )}
          
          {animals.length > 0 && !hasMore && !loadingLocation && (
            <div className="mt-8 text-center text-gray-500 text-sm">
              已經到底囉！沒有更多資料了。
            </div>
          )}
        </>
      )}
      {/* Custom Discovery Modal */}
      {isCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">新增自訂發現</h3>
              <button onClick={() => setIsCustomModalOpen(false)} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">生物名稱 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={customAnimal.name} 
                  onChange={e => setCustomAnimal({...customAnimal, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  placeholder="例如：台灣藍鵲"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">圖片 <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <label className="flex-shrink-0 cursor-pointer inline-flex items-center px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
                      <Upload className="w-4 h-4 mr-2" />
                      上傳照片
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageUpload}
                      />
                    </label>
                    <span className="text-sm text-gray-500">或</span>
                    <input 
                      type="text" 
                      value={customAnimal.imageUrl} 
                      onChange={e => setCustomAnimal({...customAnimal, imageUrl: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
                      placeholder="貼上圖片網址 (URL)"
                    />
                  </div>
                  {customAnimal.imageUrl && (
                    <div className="h-40 w-full rounded-lg overflow-hidden border border-gray-200 bg-gray-50 relative group">
                      <img src={customAnimal.imageUrl} alt="預覽" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = 'none')} />
                      <button 
                        onClick={() => setCustomAnimal({...customAnimal, imageUrl: ''})}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分類</label>
                  <select 
                    value={customAnimal.category}
                    onChange={e => setCustomAnimal({...customAnimal, category: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    {CATEGORIES.filter(c => c.id !== 'All').map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                    <option value="Other">其他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">稀有度</label>
                  <select 
                    value={customAnimal.rarity}
                    onChange={e => setCustomAnimal({...customAnimal, rarity: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  >
                    <option value="Common">常見</option>
                    <option value="Uncommon">少見</option>
                    <option value="Rare">稀有</option>
                    <option value="Epic">史詩</option>
                    <option value="Legendary">傳說</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">學名 (選填)</label>
                <input 
                  type="text" 
                  value={customAnimal.scientificName} 
                  onChange={e => setCustomAnimal({...customAnimal, scientificName: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                  placeholder="例如：Urocissa caerulea"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">觀察筆記 / 描述</label>
                <textarea 
                  value={customAnimal.description} 
                  onChange={e => setCustomAnimal({...customAnimal, description: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 outline-none resize-none h-24"
                  placeholder="記錄一下你在哪裡、什麼情況下發現它的..."
                />
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              <button 
                onClick={() => setIsCustomModalOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-200 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSaveCustom}
                className="px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
              >
                儲存發現
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
