import React, { useState, useEffect } from 'react';
import { AnimalCard } from '../components/AnimalCard';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';
import { Link } from 'react-router-dom';
import { BookOpen, Leaf, Map as MapIcon, PieChart, List, Award, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { Animal } from '../types';
import { animals as fallbackAnimals } from '../data/animals';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface CollectedRecord {
  animal: Animal;
  collectedAt: Date;
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'All': '全部',
  'Birds': '鳥類',
  'Insects': '昆蟲',
  'Reptiles': '爬蟲類',
  'Spiders': '蜘蛛',
  'Plants': '植物',
  'Flowers': '花',
  'Trees': '樹木',
  'Other': '其他 (早期紀錄)'
};

export function CollectionPage() {
  const { user } = useAuth();
  const [collectedRecords, setCollectedRecords] = useState<CollectedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'stats' | 'map'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isBadgesExpanded, setIsBadgesExpanded] = useState(false);

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
          
          if (data.animalName && data.animalImageUrl) {
             animal = {
               id: data.animalId,
               name: data.animalName,
               scientificName: data.animalScientificName || 'Unknown',
               description: data.description || '這是一筆您已蒐集的生物紀錄。',
               imageUrl: data.animalImageUrl,
               habitat: data.habitat || '未知',
               rarity: data.rarity || 'Common',
               characteristics: data.characteristics,
               diet: data.diet,
               category: data.category || 'Other',
               lat: data.lat,
               lng: data.lng
             };
          } else {
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

  // Calculate stats
  const categoryCounts = collectedRecords.reduce((acc, record) => {
    const cat = record.animal.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categoryCounts).map(([name, value]) => ({ 
    name: CATEGORY_TRANSLATIONS[name] || name, 
    value 
  }));

  // Badges logic
  const BADGE_GROUPS = [
    {
      title: '🏆 總數里程碑',
      badges: [
        { id: 'total_1', icon: '🌱', name: '生態新手', desc: '收集第1隻生物', condition: (total: number) => total >= 1 },
        { id: 'total_5', icon: '🚶', name: '業餘觀察家', desc: '收集5隻生物', condition: (total: number) => total >= 5 },
        { id: 'total_10', icon: '🌟', name: '生態探索者', desc: '收集10隻生物', condition: (total: number) => total >= 10 },
        { id: 'total_20', icon: '🔍', name: '尋寶達人', desc: '收集20隻生物', condition: (total: number) => total >= 20 },
        { id: 'total_30', icon: '👑', name: '生態大師', desc: '收集30隻生物', condition: (total: number) => total >= 30 },
        { id: 'total_50', icon: '🏆', name: '圖鑑守護者', desc: '收集50隻生物', condition: (total: number) => total >= 50 },
        { id: 'total_100', icon: '💯', name: '百獸之王', desc: '收集100隻生物', condition: (total: number) => total >= 100 },
      ]
    },
    {
      title: '🦅 鳥類專精',
      badges: [
        { id: 'bird_1', icon: '🪶', name: '偶遇飛羽', desc: '收集1種鳥類', condition: (total: number, counts: Record<string, number>) => (counts['Birds'] || 0) >= 1 },
        { id: 'bird_5', icon: '🐦', name: '賞鳥愛好者', desc: '收集5種鳥類', condition: (total: number, counts: Record<string, number>) => (counts['Birds'] || 0) >= 5 },
        { id: 'bird_10', icon: '🦅', name: '飛羽專家', desc: '收集10種鳥類', condition: (total: number, counts: Record<string, number>) => (counts['Birds'] || 0) >= 10 },
      ]
    },
    {
      title: '🦋 昆蟲專精',
      badges: [
        { id: 'insect_1', icon: '🐛', name: '蟲蟲危機', desc: '收集1種昆蟲', condition: (total: number, counts: Record<string, number>) => (counts['Insects'] || 0) >= 1 },
        { id: 'insect_5', icon: '🦋', name: '昆蟲觀察家', desc: '收集5種昆蟲', condition: (total: number, counts: Record<string, number>) => (counts['Insects'] || 0) >= 5 },
        { id: 'insect_10', icon: '🪲', name: '捕蟲大師', desc: '收集10種昆蟲', condition: (total: number, counts: Record<string, number>) => (counts['Insects'] || 0) >= 10 },
      ]
    },
    {
      title: '🦎 爬蟲與蜘蛛',
      badges: [
        { id: 'reptile_1', icon: '🦎', name: '尋找冷血', desc: '收集1種爬蟲類', condition: (total: number, counts: Record<string, number>) => (counts['Reptiles'] || 0) >= 1 },
        { id: 'reptile_5', icon: '🐊', name: '爬蟲專家', desc: '收集5種爬蟲類', condition: (total: number, counts: Record<string, number>) => (counts['Reptiles'] || 0) >= 5 },
        { id: 'spider_1', icon: '🕸️', name: '蜘蛛人', desc: '收集1種蜘蛛', condition: (total: number, counts: Record<string, number>) => (counts['Spiders'] || 0) >= 1 },
        { id: 'spider_5', icon: '🕷️', name: '蛛形綱學者', desc: '收集5種蜘蛛', condition: (total: number, counts: Record<string, number>) => (counts['Spiders'] || 0) >= 5 },
      ]
    },
    {
      title: '🌿 植物專精',
      badges: [
        { id: 'plant_1', icon: '🍀', name: '綠手指', desc: '收集1種植物', condition: (total: number, counts: Record<string, number>) => ((counts['Plants'] || 0) + (counts['Flowers'] || 0) + (counts['Trees'] || 0)) >= 1 },
        { id: 'plant_5', icon: '🌿', name: '植物學家', desc: '收集5種植物', condition: (total: number, counts: Record<string, number>) => ((counts['Plants'] || 0) + (counts['Flowers'] || 0) + (counts['Trees'] || 0)) >= 5 },
        { id: 'plant_10', icon: '🌳', name: '森林守護者', desc: '收集10種植物', condition: (total: number, counts: Record<string, number>) => ((counts['Plants'] || 0) + (counts['Flowers'] || 0) + (counts['Trees'] || 0)) >= 10 },
      ]
    },
    {
      title: '🌍 生態多樣性',
      badges: [
        { id: 'diversity_3', icon: '🌈', name: '生態多樣性', desc: '收集3種不同分類的生物', condition: (total: number, counts: Record<string, number>) => Object.keys(counts).length >= 3 },
        { id: 'diversity_5', icon: '🌍', name: '萬物共生', desc: '收集5種不同分類的生物', condition: (total: number, counts: Record<string, number>) => Object.keys(counts).length >= 5 },
      ]
    }
  ];

  // Filter records
  const filteredRecords = collectedRecords.filter(record => {
    const matchesSearch = record.animal.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          record.animal.scientificName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || record.animal.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['All', ...Array.from(new Set(collectedRecords.map(r => r.animal.category || 'Other')))];

  // Calculate badge progress
  const totalBadges = BADGE_GROUPS.reduce((sum, group) => sum + group.badges.length, 0);
  const unlockedBadgesCount = BADGE_GROUPS.reduce((sum, group) => {
    return sum + group.badges.filter(b => b.condition(collectedRecords.length, categoryCounts)).length;
  }, 0);

  // Map center
  const mapCenter = collectedRecords.find(r => r.animal.lat && r.animal.lng)?.animal;

  const handleUncollect = async (animal: Animal) => {
    if (!user) return;
    try {
      const recordId = `${user.uid}_${animal.id}`;
      await deleteDoc(doc(db, 'user_collections', recordId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `user_collections/${user.uid}_${animal.id}`);
    }
  };

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

        {/* Badges Section */}
        <div className="pt-4 border-t border-gray-100">
          <button 
            onClick={() => setIsBadgesExpanded(!isBadgesExpanded)}
            className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-xl transition-colors"
          >
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <h3 className="font-bold text-gray-800">成就徽章</h3>
              <span className="text-sm text-gray-500 ml-2 font-medium">
                (已解鎖 {unlockedBadgesCount} / {totalBadges})
              </span>
            </div>
            {isBadgesExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          {isBadgesExpanded && (
            <div className="flex flex-col gap-4 mt-4">
              {BADGE_GROUPS.map((group) => (
                <div key={group.title} className="bg-gray-50/50 rounded-xl p-4 border border-gray-100">
                  <h4 className="text-sm font-bold text-gray-700 mb-3">{group.title}</h4>
                  <div className="flex flex-wrap gap-3">
                    {group.badges.map((badge) => {
                      const isUnlocked = badge.condition(collectedRecords.length, categoryCounts);
                      return (
                        <div 
                          key={badge.id} 
                          className={`relative group flex items-center gap-2 border px-3 py-1.5 rounded-lg transition-all duration-300 cursor-pointer ${
                            isUnlocked 
                              ? 'bg-yellow-50 border-yellow-200 shadow-sm hover:bg-yellow-100 hover:-translate-y-1 hover:shadow-md' 
                              : 'bg-white border-gray-200 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:-translate-y-1 hover:shadow-sm'
                          }`} 
                        >
                          <span className="text-xl">{badge.icon}</span>
                          <span className={`text-sm font-medium transition-colors ${isUnlocked ? 'text-yellow-800' : 'text-gray-500 group-hover:text-gray-700'}`}>
                            {badge.name}
                          </span>
                          
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-max max-w-[220px] px-3 py-2.5 bg-gray-900/95 backdrop-blur-sm text-white text-xs rounded-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl pointer-events-none border border-gray-700">
                            <div className="flex items-center justify-between gap-3 font-bold mb-1.5 text-sm border-b border-gray-700 pb-1.5">
                              <span>{badge.name}</span>
                              {isUnlocked ? <span className="text-green-400 text-xs bg-green-400/10 px-1.5 py-0.5 rounded">已解鎖</span> : <span className="text-gray-400 text-xs bg-gray-400/10 px-1.5 py-0.5 rounded">未解鎖</span>}
                            </div>
                            <div className="text-gray-300 leading-relaxed">{badge.desc}</div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex items-center px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${
            activeTab === 'list' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <List className="w-4 h-4 mr-2" />
          圖鑑列表
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${
            activeTab === 'stats' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <PieChart className="w-4 h-4 mr-2" />
          生態統計
        </button>
        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center px-4 py-2 rounded-xl font-medium transition-colors whitespace-nowrap ${
            activeTab === 'map' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
          }`}
        >
          <MapIcon className="w-4 h-4 mr-2" />
          足跡地圖
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
        </div>
      ) : collectedRecords.length === 0 ? (
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
      ) : (
        <>
          {activeTab === 'list' && (
            <>
              <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input 
                    type="text" 
                    placeholder="搜尋生物名稱..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setFilterCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                        filterCategory === cat 
                          ? 'bg-green-100 text-green-800 border border-green-200' 
                          : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {CATEGORY_TRANSLATIONS[cat] || cat}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRecords.map((record) => (
                  <AnimalCard
                    key={`${record.animal.id}-${record.collectedAt.getTime()}`}
                    animal={record.animal}
                    isCollected={true}
                    collectedAt={record.collectedAt}
                    onUncollect={handleUncollect}
                  />
                ))}
              </div>
              {filteredRecords.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  找不到符合條件的生物。
                </div>
              )}
            </>
          )}

          {activeTab === 'stats' && (
            <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">生態多樣性分佈</h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={150}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm h-[600px]">
              {mapCenter ? (
                <MapContainer 
                  center={[mapCenter.lat || 23.5, mapCenter.lng || 121]} 
                  zoom={13} 
                  style={{ height: '100%', width: '100%', borderRadius: '12px' }}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  
                  {/* 軌跡連線 */}
                  <Polyline 
                    positions={collectedRecords
                      .filter(r => r.animal.lat && r.animal.lng)
                      .sort((a,b) => a.collectedAt.getTime() - b.collectedAt.getTime())
                      .map(r => [r.animal.lat!, r.animal.lng!])}
                    color="#10b981"
                    weight={3}
                    dashArray="8, 8"
                    opacity={0.6}
                  />

                  {collectedRecords.filter(r => r.animal.lat && r.animal.lng).map((record, idx) => {
                    const customIcon = L.divIcon({
                      className: 'custom-animal-marker',
                      html: `<div style="width: 44px; height: 44px; border-radius: 50%; border: 3px solid ${COLORS[idx % COLORS.length]}; overflow: hidden; background-color: white; box-shadow: 0 4px 6px rgba(0,0,0,0.3);"><img src="${record.animal.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;" /></div>`,
                      iconSize: [44, 44],
                      iconAnchor: [22, 22]
                    });

                    return (
                      <Marker key={idx} position={[record.animal.lat!, record.animal.lng!]} icon={customIcon}>
                        <Popup>
                          <div className="text-center min-w-[120px]">
                            <img src={record.animal.imageUrl} alt={record.animal.name} className="w-full h-24 object-cover rounded-lg mb-2" />
                            <strong className="block text-gray-900">{record.animal.name}</strong>
                            <span className="text-xs text-gray-500">{record.collectedAt.toLocaleDateString()}</span>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">
                  您目前的蒐集紀錄中沒有包含位置資訊。
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
