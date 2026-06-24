import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import { ArrowLeft, CalendarDays, CloudSun, Edit3, MapPin } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/firebase';
import { googleMapsUrl } from '../lib/locationUtils';
import { Animal } from '../types';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface JournalRecord {
  id: string;
  animal: Animal;
  observedAt: Date;
  collectedAt: Date;
  notes: string;
  weather: string;
  locationName: string;
  photoUrl: string;
}

const toDate = (value: any, fallback = new Date()) => {
  if (!value) return fallback;
  if (typeof value.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const rarityLabels: Record<Animal['rarity'], string> = {
  Common: '常見',
  Uncommon: '少見',
  Rare: '稀有',
  Epic: '史詩',
  Legendary: '傳說',
};

export function JournalDetailPage() {
  const { user } = useAuth();
  const { recordId } = useParams();
  const navigate = useNavigate();
  const [record, setRecord] = useState<JournalRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!user || !recordId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(doc(db, 'user_collections', decodeURIComponent(recordId)), snapshot => {
      if (!snapshot.exists() || snapshot.data().userId !== user.uid) {
        setNotFound(true);
        setRecord(null);
        setLoading(false);
        return;
      }

      const data = snapshot.data();
      const collectedAt = toDate(data.collectedAt);
      const animal: Animal = {
        id: data.animalId,
        name: data.animalName || '未知生物',
        scientificName: data.animalScientificName || 'Unknown',
        description: data.description || '這是一筆您已蒐集的生物紀錄。',
        imageUrl: data.photoUrl || data.animalImageUrl || '',
        habitat: data.habitat || '未知',
        rarity: data.rarity || 'Common',
        characteristics: data.characteristics,
        diet: data.diet,
        category: data.category || 'Other',
        lat: data.lat,
        lng: data.lng,
      };

      setRecord({
        id: snapshot.id,
        animal,
        collectedAt,
        observedAt: toDate(data.observedAt, collectedAt),
        notes: data.notes || '',
        weather: data.weather || '',
        locationName: data.locationName || '',
        photoUrl: data.photoUrl || animal.imageUrl,
      });
      setNotFound(false);
      setLoading(false);
    }, () => {
      setNotFound(true);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [recordId, user]);

  if (!user) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">請先登入</h1>
        <p className="text-gray-600 mt-2">登入後即可查看觀察紀錄。</p>
      </div>
    );
  }

  if (loading) {
    return <div className="max-w-5xl mx-auto px-4 py-16 text-gray-500">載入紀錄中...</div>;
  }

  if (notFound || !record) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">找不到這筆紀錄</h1>
        <Link to="/collection" className="mt-4 inline-block text-green-700 font-medium">回到自然日誌</Link>
      </div>
    );
  }

  const hasMap = record.animal.lat && record.animal.lng;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center text-gray-600 hover:text-gray-900 font-medium">
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回
        </button>
        <Link to={`/collection?edit=${encodeURIComponent(record.id)}`} className="inline-flex items-center rounded-lg bg-green-600 px-4 py-2 text-white font-medium hover:bg-green-700">
          <Edit3 className="w-4 h-4 mr-2" />
          編輯紀錄
        </Link>
      </div>

      <article className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <img src={record.photoUrl || record.animal.imageUrl} alt={record.animal.name} className="w-full h-[360px] object-cover bg-gray-100" referrerPolicy="no-referrer" />
        <div className="p-6 grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
          <section>
            <div className="mb-4">
              <span className="inline-flex rounded-full border border-green-100 bg-green-50 px-3 py-1 text-sm font-medium text-green-700">
                {rarityLabels[record.animal.rarity]}
              </span>
              <h1 className="mt-3 text-3xl font-bold text-gray-900">{record.animal.name}</h1>
              <p className="text-gray-500 italic font-serif">{record.animal.scientificName}</p>
            </div>

            <div className="space-y-4 text-gray-700">
              <p className="font-medium text-green-800 bg-green-50 p-3 rounded-xl border border-green-100">{record.animal.description}</p>
              {record.animal.characteristics && <p><strong>特色：</strong>{record.animal.characteristics}</p>}
              {record.animal.diet && <p><strong>食性：</strong>{record.animal.diet}</p>}
              <p><strong>棲地：</strong>{record.animal.habitat}</p>
              <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                <h2 className="font-bold text-gray-900 mb-2">觀察筆記</h2>
                <p className="whitespace-pre-wrap">{record.notes || '尚未新增觀察筆記。'}</p>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-gray-700"><CalendarDays className="w-4 h-4 text-green-600" />{record.observedAt.toLocaleString()}</div>
              {record.weather && <div className="flex items-center gap-2 text-gray-700"><CloudSun className="w-4 h-4 text-green-600" />{record.weather}</div>}
              {record.locationName && <div className="flex items-center gap-2 text-gray-700"><MapPin className="w-4 h-4 text-green-600" />{record.locationName}</div>}
            </div>

            {hasMap ? (
              <div className="rounded-xl border border-gray-100 overflow-hidden h-[320px]">
                <MapContainer center={[record.animal.lat!, record.animal.lng!]} zoom={15} style={{ height: '100%', width: '100%' }}>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[record.animal.lat!, record.animal.lng!]}>
                    <Popup>{record.animal.name}</Popup>
                  </Marker>
                </MapContainer>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-gray-500">這筆紀錄尚未設定地圖位置。</div>
            )}

            {hasMap && (
              <a href={googleMapsUrl(record.animal.lat!, record.animal.lng!)} target="_blank" rel="noreferrer" className="block text-center rounded-lg border border-green-200 bg-green-50 px-4 py-2 font-medium text-green-700 hover:bg-green-100">
                在 Google Maps 開啟
              </a>
            )}
          </aside>
        </div>
      </article>
    </div>
  );
}
