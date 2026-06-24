/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';

const ExplorePage = lazy(() => import('./pages/ExplorePage').then(module => ({ default: module.ExplorePage })));
const CollectionPage = lazy(() => import('./pages/CollectionPage').then(module => ({ default: module.CollectionPage })));
const JournalDetailPage = lazy(() => import('./pages/JournalDetailPage').then(module => ({ default: module.JournalDetailPage })));

function PageFallback() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="h-8 w-40 rounded-lg bg-gray-200 animate-pulse mb-6" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(item => (
          <div key={item} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="aspect-[4/3] bg-gray-200 animate-pulse" />
            <div className="p-5 space-y-3">
              <div className="h-5 w-2/3 rounded bg-gray-200 animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-gray-100 animate-pulse" />
              <div className="h-20 rounded-lg bg-gray-100 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-[#f8fafc] font-sans text-gray-900">
            <Navbar />
            <main>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<ExplorePage />} />
                  <Route path="/collection" element={<CollectionPage />} />
                  <Route path="/collection/:recordId" element={<JournalDetailPage />} />
                </Routes>
              </Suspense>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
