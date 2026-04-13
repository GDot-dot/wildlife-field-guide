import React, { useState, useEffect } from 'react';
import { AnimalCard } from '../components/AnimalCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';
import { getNearbySpecies } from '../services/inaturalist';
import { Animal } from '../types';
import { MapPin, Loader2, AlertCircle } from 'lucide-react';

export function ExplorePage() {
  const { user } = useAuth();
  const [collectedIds, setCollectedIds] = useState<Set<string>>(new Set());
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

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

  const handleGetLocation = () => {
    setLoadingLocation(true);
    setLocationError(null);

    if (!('geolocation' in navigator)) {
      setLocationError('您的瀏覽器不支援定位功能');
      setLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const nearbyAnimals = await getNearbySpecies(latitude, longitude);
          setAnimals(nearbyAnimals);
        } catch (error) {
          console.error(error);
          setLocationError('無法取得附近的生物資料，請稍後再試');
        } finally {
          setLoadingLocation(false);
        }
      },
      (error) => {
        console.error(error);
        setLocationError('無法取得位置資訊，請確認是否允許定位權限');
        setLoadingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
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
            讀取您的 GPS 定位，尋找附近出沒的鳥類與爬蟲類。
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {animals.map((animal) => (
            <AnimalCard
              key={animal.id}
              animal={animal}
              isCollected={collectedIds.has(animal.id)}
              onCollect={handleCollect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
