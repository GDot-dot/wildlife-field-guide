import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errorUtils';
import { Link } from 'react-router-dom';
import { BookOpen, Leaf, Map as MapIcon, PieChart, List, Award, Search, ChevronDown, ChevronUp, CalendarDays, Edit3, X, Upload, Clock, MapPin, CloudSun } from 'lucide-react';
import { Animal } from '../types';
import { animals as fallbackAnimals } from '../data/animals';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface CollectedRecord {
  id: string;
  animal: Animal;
  collectedAt: Date;
  observedAt: Date;
  notes: string;
  weather: string;
  locationName: string;
  photoUrl: string;
}

type CollectionTab = 'list' | 'timeline' | 'stats' | 'map';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  All: '全部',
  Birds: '鳥類',
  Insects: '昆蟲',
  Reptiles: '爬蟲類',
  Spiders: '蜘蛛',
  Plants: '植物',
  Flowers: '花',
  Trees: '樹木',
  Other: '其他',
};

const toDate = (value: any, fallback = new Date()) => {
  if (!value) return fallback;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const toDateInputValue = (date: Date) => date.toISOString().slice(0, 10);

const compressImageFile = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onerror = reject;
  reader.onload = (event) => {
    const img = new Image();
    img.onerror = reject;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxSize = 900;

      if (width > height && width > maxSize) {
        height *= maxSize / width;
        width = maxSize;
      } else if (height > maxSize) {
        width *= maxSize / height;
        height = maxSize;
      }

      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.72));
    };
    img.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
});

export function CollectionPage() {
  const { user } = useAuth();
  const [collectedRecords, setCollectedRecords] = useState<CollectedRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<CollectionTab>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isBadgesExpanded, setIsBadgesExpanded] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CollectedRecord | null>(null);
  const [editForm, setEditForm] = useState({ observedAt: '', weather: '', locationName: '', notes: '', photoUrl: '' });

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const q = query(collection(db, 'user_collections'), where('userId', '==', user.uid));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: CollectedRecord[] = [];
      snapshot.forEach((entry) => {
        const data = entry.data();
        if (!data.collectedAt) return;

        let animal: Animal | undefined;
        if (data.animalName && data.animalImageUrl) {
          animal = {
            id: data.animalId,
            name: data.animalName,
            scientificName: data.animalScientificName || 'Unknown',
            description: data.description || '這是一筆您已蒐集的生物紀錄。',
            imageUrl: data.photoUrl || data.animalImageUrl,
            habitat: data.habitat || '未知',
            rarity: data.rarity || 'Common',
            characteristics: data.characteristics,
            diet: data.diet,
            category: data.category || 'Other',
            lat: data.lat,
            lng: data.lng,
          };
        } else {
          animal = fallbackAnimals.find(a => a.id === data.animalId);
        }

        if (!animal) return;

        const collectedAt = toDate(data.collectedAt);
        const observedAt = toDate(data.observedAt, collectedAt);
        records.push({
          id: entry.id,
          animal,
          collectedAt,
          observedAt,
          notes: data.notes || '',
          weather: data.weather || '',
          locationName: data.locationName || '',
          photoUrl: data.photoUrl || animal.imageUrl,
        });
      });

      records.sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime());
      setCollectedRecords(records);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'user_collections');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const openEditor = (record: CollectedRecord) => {
    setEditingRecord(record);
    setEditForm({
      observedAt: toDateInputValue(record.observedAt),
      weather: record.weather,
      locationName: record.locationName,
      notes: record.notes,
      photoUrl: record.photoUrl,
    });
  };

  const handleSaveJournal = async () => {
    if (!editingRecord) return;
    try {
      await updateDoc(doc(db, 'user_collections', editingRecord.id), {
        observedAt: new Date(editForm.observedAt || toDateInputValue(new Date())).toISOString(),
        weather: editForm.weather,
        locationName: editForm.locationName,
        notes: editForm.notes,
        photoUrl: editForm.photoUrl,
        animalImageUrl: editForm.photoUrl || editingRecord.animal.imageUrl,
      });
      setEditingRecord(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `user_collections/${editingRecord.id}`);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditForm(prev => ({ ...prev, photoUrl: '' }));
    setEditForm(prev => ({ ...prev, photoUrl: prev.photoUrl }));
    const photoUrl = await compressImageFile(file);
    setEditForm(prev => ({ ...prev, photoUrl }));
  };

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">請先登入</h2>
        <p className="text-gray-600">登入後即可查看你的專屬生態圖鑑蒐集進度。</p>
      </div>
    );
  }

  const categoryCounts = collectedRecords.reduce((acc, record) => {
    const cat = record.animal.category || 'Other';
    acc[cat] = (acc[cat] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.entries(categoryCounts).map(([name, value]) => ({
    name: CATEGORY_TRANSLATIONS[name] || name,
    value,
  }));

  const BADGE_GROUPS = [
    {
      title: '總數里程碑',
      badges: [
        { id: 'total_1', icon: '🌱', name: '生態新手', desc: '收集第1筆紀錄', condition: (total: number) => total >= 1 },
        { id: 'total_5', icon: '🚶', name: '業餘觀察家', desc: '收集5筆紀錄', condition: (total: number) => total >= 5 },
        { id: 'total_10', icon: '🌟', name: '生態探索者', desc: '收集10筆紀錄', condition: (total: number) => total >= 10 },
        { id: 'total_30', icon: '👑', name: '生態大師', desc: '收集30筆紀錄', condition: (total: number) => total >= 30 },
      ],
    },
    {
      title: '分類專精',
      badges: [
        { id: 'bird_5', icon: '🐦', name: '賞鳥愛好者', desc: '收集5種鳥類', condition: (_: number, counts: Record<string, number>) => (counts.Birds || 0) >= 5 },
        { id: 'insect_5', icon: '🦋', name: '昆蟲觀察家', desc: '收集5種昆蟲', condition: (_: number, counts: Record<string, number>) => (counts.Insects || 0) >= 5 },
        { id: 'plant_5', icon: '🌿', name: '植物學家', desc: '收集5種植物', condition: (_: number, counts: Record<string, number>) => ((counts.Plants || 0) + (counts.Flowers || 0) + (counts.Trees || 0)) >= 5 },
      ],
    },
    {
      title: '自然日誌',
      badges: [
        { id: 'journal_3', icon: '📝', name: '觀察筆記', desc: '寫下3篇觀察筆記', condition: () => collectedRecords.filter(r => r.notes.trim()).length >= 3 },
        { id: 'place_3', icon: '📍', name: '足跡展開', desc: '記錄3個有地點的發現', condition: () => collectedRecords.filter(r => r.locationName || (r.animal.lat && r.animal.lng)).length >= 3 },
      ],
    },
  ];

  const filteredRecords = collectedRecords.filter(record => {
    const term = searchTerm.toLowerCase();
    const matchesSearch = record.animal.name.toLowerCase().includes(term) ||
      record.animal.scientificName.toLowerCase().includes(term) ||
      record.notes.toLowerCase().includes(term) ||
      record.locationName.toLowerCase().includes(term);
    const matchesCategory = filterCategory === 'All' || record.animal.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories: string[] = ['All', ...Array.from(new Set<string>(collectedRecords.map(r => r.animal.category || 'Other')))];
  const totalBadges = BADGE_GROUPS.reduce((sum, group) => sum + group.badges.length, 0);
  const unlockedBadgesCount = BADGE_GROUPS.reduce((sum, group) => (
    sum + group.badges.filter(b => b.condition(collectedRecords.length, categoryCounts)).length
  ), 0);
  const mapRecords = collectedRecords.filter(r => r.animal.lat && r.animal.lng);
  const mapCenter = mapRecords[0]?.animal;

  const handleUncollect = async (animal: Animal) => {
    if (!user) return;
    try {
      const recordId = `${user.uid}_${animal.id}`;
      await deleteDoc(doc(db, 'user_collections', recordId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `user_collections/${user.uid}_${animal.id}`);
    }
  };

  const renderRecordCard = (record: CollectedRecord) => (
    <article key={record.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
      <img src={record.photoUrl || record.animal.imageUrl} alt={record.animal.name} className="h-48 w-full object-cover bg-gray-100" referrerPolicy="no-referrer" />
      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{record.animal.name}</h3>
              <p className="text-sm text-gray-500 italic">{record.animal.scientificName}</p>
            </div>
            <span className="rounded-full bg-green-50 border border-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
              {record.animal.rarity === 'Common' ? '常見' : record.animal.rarity === 'Uncommon' ? '少見' : record.animal.rarity === 'Rare' ? '稀有' : record.animal.rarity === 'Epic' ? '史詩' : '傳說'}
            </span>
          </div>
        </div>

        <div className="grid gap-2 text-sm text-gray-600">
          <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-green-600" />{record.observedAt.toLocaleDateString()}</div>
          {record.locationName && <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-green-600" />{record.locationName}</div>}
          {record.weather && <div className="flex items-center gap-2"><CloudSun className="w-4 h-4 text-green-600" />{record.weather}</div>}
        </div>

        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 min-h-[68px]">
          {record.notes || record.animal.description}
        </p>

        <div className="mt-auto flex gap-2 pt-2">
          <button onClick={() => openEditor(record)} className="flex-1 inline-flex items-center justify-center rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100">
            <Edit3 className="w-4 h-4 mr-1.5" />
            編輯日誌
          </button>
          <button onClick={() => handleUncollect(record.animal)} className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100">
            刪除
          </button>
        </div>
      </div>
    </article>
  );

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8 bg-white p-6 rounded-xl border border-green-100 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">自然日誌</h1>
            <p className="text-gray-600">你已經記錄了 {collectedRecords.length} 筆生態觀察。</p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><div className="text-2xl font-bold text-green-600">{collectedRecords.length}</div><div className="text-xs text-gray-500">紀錄</div></div>
            <div><div className="text-2xl font-bold text-green-600">{Object.keys(categoryCounts).length}</div><div className="text-xs text-gray-500">分類</div></div>
            <div><div className="text-2xl font-bold text-green-600">{mapRecords.length}</div><div className="text-xs text-gray-500">地點</div></div>
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <button onClick={() => setIsBadgesExpanded(!isBadgesExpanded)} className="w-full flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg transition-colors">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-yellow-500" />
              <h3 className="font-bold text-gray-800">成就徽章</h3>
              <span className="text-sm text-gray-500 ml-2 font-medium">(已解鎖 {unlockedBadgesCount} / {totalBadges})</span>
            </div>
            {isBadgesExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
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
                        <div key={badge.id} className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg ${isUnlocked ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200 opacity-60 grayscale'}`} title={badge.desc}>
                          <span className="text-xl">{badge.icon}</span>
                          <span className={`text-sm font-medium ${isUnlocked ? 'text-yellow-800' : 'text-gray-500'}`}>{badge.name}</span>
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

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {[
          { id: 'list', label: '圖鑑列表', icon: List },
          { id: 'timeline', label: '時間軸', icon: CalendarDays },
          { id: 'stats', label: '生態統計', icon: PieChart },
          { id: 'map', label: '足跡地圖', icon: MapIcon },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as CollectionTab)} className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
              <Icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div></div>
      ) : collectedRecords.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Leaf className="w-8 h-8 text-green-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">還沒有任何蒐集</h3>
          <p className="text-gray-500 mb-6">趕快去探索周遭的生物，將牠們加入圖鑑吧！</p>
          <Link to="/" className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium">開始探索</Link>
        </div>
      ) : (
        <>
          {(activeTab === 'list' || activeTab === 'timeline') && (
            <>
              <div className="mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-grow">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input type="text" placeholder="搜尋名稱、地點或筆記..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setFilterCategory(cat)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filterCategory === cat ? 'bg-green-100 text-green-800 border border-green-200' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                      {CATEGORY_TRANSLATIONS[cat] || cat}
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === 'list' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredRecords.map(renderRecordCard)}
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredRecords.map(record => (
                    <div key={record.id} className="relative pl-8">
                      <div className="absolute left-2 top-2 bottom-[-18px] w-px bg-green-100"></div>
                      <div className="absolute left-0 top-2 w-4 h-4 rounded-full bg-green-500 border-4 border-white shadow"></div>
                      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm flex gap-4">
                        <img src={record.photoUrl || record.animal.imageUrl} alt={record.animal.name} className="w-20 h-20 rounded-lg object-cover bg-gray-100" referrerPolicy="no-referrer" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs text-green-700 font-medium mb-1">{record.observedAt.toLocaleDateString()}</div>
                              <h3 className="font-bold text-gray-900">{record.animal.name}</h3>
                            </div>
                            <button onClick={() => openEditor(record)} className="text-sm text-green-700 hover:text-green-900 font-medium">編輯</button>
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{record.notes || record.animal.description}</p>
                          <div className="text-xs text-gray-500 mt-2">{[record.locationName, record.weather].filter(Boolean).join('｜')}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredRecords.length === 0 && <div className="text-center py-12 text-gray-500">找不到符合條件的紀錄。</div>}
            </>
          )}

          {activeTab === 'stats' && (
            <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
              <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">生態多樣性分佈</h3>
              <div className="h-[400px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPie>
                    <Pie data={pieData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`} outerRadius={150} fill="#8884d8" dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <RechartsTooltip />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div className="bg-white p-2 rounded-xl border border-gray-100 shadow-sm h-[600px]">
              {mapCenter ? (
                <MapContainer center={[mapCenter.lat || 23.5, mapCenter.lng || 121]} zoom={13} style={{ height: '100%', width: '100%', borderRadius: '10px' }}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Polyline positions={mapRecords.slice().reverse().map(r => [r.animal.lat!, r.animal.lng!])} color="#10b981" weight={3} dashArray="8, 8" opacity={0.6} />

                  {mapRecords.map((record, idx) => {
                    const customIcon = L.divIcon({
                      className: 'custom-animal-marker',
                      html: `<div style="width:44px;height:44px;border-radius:50%;border:3px solid ${COLORS[idx % COLORS.length]};overflow:hidden;background:white;box-shadow:0 4px 6px rgba(0,0,0,0.3);"><img src="${record.photoUrl || record.animal.imageUrl}" style="width:100%;height:100%;object-fit:cover;" /></div>`,
                      iconSize: [44, 44],
                      iconAnchor: [22, 22],
                    });

                    return (
                      <Marker key={record.id} position={[record.animal.lat!, record.animal.lng!]} icon={customIcon}>
                        <Popup>
                          <div className="min-w-[180px]">
                            <img src={record.photoUrl || record.animal.imageUrl} alt={record.animal.name} className="w-full h-28 object-cover rounded-lg mb-2" />
                            <strong className="block text-gray-900">{record.animal.name}</strong>
                            <div className="text-xs text-gray-500 mt-1">{record.observedAt.toLocaleDateString()}</div>
                            {record.locationName && <div className="text-xs text-gray-600 mt-1">地點：{record.locationName}</div>}
                            {record.weather && <div className="text-xs text-gray-600 mt-1">天氣：{record.weather}</div>}
                            {record.notes && <p className="text-xs text-gray-700 mt-2 line-clamp-3">{record.notes}</p>}
                            <button onClick={() => openEditor(record)} className="mt-3 w-full rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white">查看 / 編輯紀錄</button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500">您目前的蒐集紀錄中沒有包含位置資訊。</div>
              )}
            </div>
          )}
        </>
      )}

      {editingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl w-full max-w-xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 p-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">編輯觀察日誌</h3>
                <p className="text-sm text-gray-500">{editingRecord.animal.name}</p>
              </div>
              <button onClick={() => setEditingRecord(null)} className="p-1 rounded-full hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">觀察日期</span>
                  <input type="date" value={editForm.observedAt} onChange={e => setEditForm({ ...editForm, observedAt: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </label>
                <label className="block">
                  <span className="text-sm font-medium text-gray-700">天氣</span>
                  <input value={editForm.weather} onChange={e => setEditForm({ ...editForm, weather: e.target.value })} placeholder="例如：晴朗，28°C" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </label>
              </div>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">地點名稱</span>
                <input value={editForm.locationName} onChange={e => setEditForm({ ...editForm, locationName: e.target.value })} placeholder="例如：大安森林公園" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">照片</span>
                <div className="mt-1 flex gap-3">
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                    <Upload className="w-4 h-4 mr-2" />
                    上傳
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  </label>
                  <input value={editForm.photoUrl} onChange={e => setEditForm({ ...editForm, photoUrl: e.target.value })} placeholder="或貼上圖片網址" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                {editForm.photoUrl && <img src={editForm.photoUrl} alt="觀察照片預覽" className="mt-3 h-44 w-full rounded-lg object-cover bg-gray-100" />}
              </label>

              <label className="block">
                <span className="text-sm font-medium text-gray-700">觀察筆記</span>
                <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="記錄牠出現的位置、行為、環境或你的發現..." className="mt-1 h-32 w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500" />
              </label>
            </div>

            <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 p-4">
              <button onClick={() => setEditingRecord(null)} className="rounded-lg px-4 py-2 font-medium text-gray-600 hover:bg-gray-200">取消</button>
              <button onClick={handleSaveJournal} className="rounded-lg bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700">儲存日誌</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
