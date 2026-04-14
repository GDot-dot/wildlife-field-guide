import React from 'react';
import { cn } from './Navbar';

export function SkeletonCard() {
  return (
    <div className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm animate-pulse">
      <div className="relative aspect-[4/3] bg-gray-200"></div>
      
      <div className="p-5 flex flex-col flex-grow">
        <div className="mb-4">
          <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        </div>
        
        <div className="space-y-3 mb-4 flex-grow">
          <div className="h-20 bg-gray-100 rounded-lg w-full"></div>
          <div className="h-4 bg-gray-100 rounded w-full"></div>
          <div className="h-4 bg-gray-100 rounded w-5/6"></div>
          <div className="h-4 bg-gray-100 rounded w-4/6"></div>
        </div>
        
        <div className="mt-auto pt-4 border-t border-gray-50">
          <div className="h-10 bg-gray-100 rounded-xl w-full"></div>
        </div>
      </div>
    </div>
  );
}
