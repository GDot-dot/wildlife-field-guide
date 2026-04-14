import React from 'react';
import { Animal } from '../types';
import { CheckCircle2, PlusCircle } from 'lucide-react';
import { cn } from './Navbar';

interface AnimalCardProps {
  animal: Animal;
  isCollected: boolean;
  onCollect?: (animal: Animal) => void;
  collectedAt?: Date;
}

export function AnimalCard({ animal, isCollected, onCollect, collectedAt }: AnimalCardProps) {
  const rarityColors = {
    Common: 'bg-gray-100 text-gray-700 border-gray-200',
    Uncommon: 'bg-blue-50 text-blue-700 border-blue-200',
    Rare: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  const rarityLabels = {
    Common: '常見',
    Uncommon: '少見',
    Rare: '稀有',
  };

  return (
    <div className={cn(
      "group relative flex flex-col bg-white rounded-2xl overflow-hidden border transition-all duration-300 hover:shadow-xl",
      isCollected ? "border-green-200 shadow-sm" : "border-gray-100 shadow-sm hover:-translate-y-1"
    )}>
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        <img 
          src={animal.imageUrl} 
          alt={animal.name}
          referrerPolicy="no-referrer"
          className={cn(
            "w-full h-full object-cover transition-transform duration-500 group-hover:scale-105",
            !isCollected && "grayscale-[0.3]"
          )}
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium border backdrop-blur-md bg-white/80",
            rarityColors[animal.rarity]
          )}>
            {rarityLabels[animal.rarity]}
          </span>
        </div>
        {isCollected && (
          <div className="absolute top-3 right-3 bg-green-500 text-white p-1.5 rounded-full shadow-lg">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        )}
      </div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-2">
          <h3 className="text-xl font-bold text-gray-900">{animal.name}</h3>
          <p className="text-sm text-gray-500 italic font-serif">{animal.scientificName}</p>
        </div>
        
        <div className="text-sm text-gray-600 mb-4 flex-grow space-y-3">
          <p className="font-medium text-green-800 bg-green-50 p-2.5 rounded-lg border border-green-100">
            {animal.description}
          </p>
          
          {animal.characteristics && (
            <p className="leading-relaxed">
              <span className="font-bold text-gray-700 block mb-0.5">✨ 特色：</span>
              {animal.characteristics}
            </p>
          )}
          
          {animal.diet && (
            <p className="leading-relaxed">
              <span className="font-bold text-gray-700 block mb-0.5">🍽️ 食性：</span>
              {animal.diet}
            </p>
          )}
          
          <p className="leading-relaxed">
            <span className="font-bold text-gray-700 block mb-0.5">🏡 棲地：</span>
            {animal.habitat}
          </p>
        </div>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
          {!isCollected && onCollect && (
            <button
              onClick={() => onCollect(animal)}
              className="inline-flex items-center justify-center w-full py-2 rounded-xl bg-green-50 text-green-700 font-medium hover:bg-green-600 hover:text-white transition-colors"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              標記為已蒐集
            </button>
          )}
          
          {isCollected && collectedAt && (
            <div className="text-xs text-green-600 font-medium bg-green-50 px-3 py-2 rounded-lg w-full text-center">
              已於 {collectedAt.toLocaleDateString()} 發現
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
