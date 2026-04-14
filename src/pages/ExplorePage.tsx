import React, { useState, useEffect } from 'react';
import { AnimalCard } from '../components/AnimalCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';
import { getNearbySpecies } from '../services/inaturalist';
import { Animal } from '../types';
import { MapPin, Loader2, AlertCircle, Filter } from 'lucide-react';

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
  const [hasMore, setHasMore] = useState(true);

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
        animalId: animal.id,
        animalName: animal.name,
        animalImageUrl: animal.imageUrl,
        description: animal.description,
        habitat: animal.habitat,
        collectedAt: serverTimestamp()
      };
      
      if (animal.soundUrl) dataToSave.soundUrl = animal.soundUrl;
      if (animal.characteristics) dataToSave.characteristics = animal.characteristics;
      if (animal.diet) dataToSave.diet = animal.diet;

      await setDoc(doc(db, 'user_collections', recordId), dataToSave);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `user_collections/${user.uid}_${animal.id}`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">探索地區生物</h1>
          <p className="text-gray-600">
            讀取您的 GPS 定位，尋找附近出沒的鳥類、昆蟲與爬蟲類。
          </p>
        </div>
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

      {currentLocation && (
        <div className="mb-6 flex flex-col sm:flex-row gap-4 sm:items-center justify-between bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
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
      )}

      {locationError && (
        <div className="mb-8 p-4 bg-red-50 text-red-700 rounded-xl flex items-center gap-3 border border-red-100">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>{locationError}</p>
        </div>
      )}

      {animals.length === 0 && !loadingLocation && !locationError ? (
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
            {animals.map((animal, index) => (
              <AnimalCard
                key={`${animal.id}-${index}`}
                animal={animal}
                isCollected={collectedIds.has(animal.id)}
                onCollect={handleCollect}
              />
            ))}
          </div>
          
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
    </div>
  );
}
