import React, { useState, useEffect } from 'react';
import { AnimalCard } from '../components/AnimalCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';
import { Link } from 'react-router-dom';
import { BookOpen, Leaf } from 'lucide-react';
import { Animal } from '../types';
import { animals as fallbackAnimals } from '../data/animals';

interface CollectedRecord {
  animal: Animal;
  collectedAt: Date;
}

export function CollectionPage() {
  const { user } = useAuth();
  const [collectedRecords, setCollectedRecords] = useState<CollectedRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'user_collections'), where('userId', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: CollectedRecord[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.collectedAt) {
          let animal: Animal | undefined;
          
          // Try to construct Animal from Firestore data
          if (data.animalName && data.animalImageUrl) {
             animal = {
               id: data.animalId,
               name: data.animalName,
               scientificName: data.animalScientificName || 'Unknown',
               description: data.description || '這是一筆您已蒐集的生物紀錄。',
               imageUrl: data.animalImageUrl,
               habitat: data.habitat || '未知',
               rarity: 'Common',
               soundUrl: data.soundUrl,
               characteristics: data.characteristics,
               diet: data.diet
             };
          } else {
             // Fallback to local data if missing (for older records)
             animal = fallbackAnimals.find(a => a.id === data.animalId);
          }

          if (animal) {
            records.push({
              animal,
              collectedAt: data.collectedAt.toDate()
            });
          }
        }
      });
      
      // Sort by collectedAt descending
      records.sort((a, b) => b.collectedAt.getTime() - a.collectedAt.getTime());
      setCollectedRecords(records);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_collections');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">請先登入</h2>
        <p className="text-gray-600">登入後即可查看你的專屬生態圖鑑蒐集進度。</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 bg-white p-6 rounded-2xl border border-green-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">我的蒐集</h1>
            <p className="text-gray-600">
              你已經發現了 {collectedRecords.length} 種生物！繼續探索吧。
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-600">{collectedRecords.length}</div>
            <div className="text-sm text-gray-500">總蒐集數</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : collectedRecords.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {collectedRecords.map((record) => (
            <AnimalCard
              key={`${record.animal.id}-${record.collectedAt.getTime()}`}
              animal={record.animal}
              isCollected={true}
              collectedAt={record.collectedAt}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Leaf className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">還沒有任何蒐集</h3>
          <p className="text-gray-500 mb-6">趕快去探索周遭的生物，將牠們加入圖鑑吧！</p>
          <Link 
            to="/"
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium"
          >
            開始探索
          </Link>
        </div>
      )}
    </div>
  );
}
