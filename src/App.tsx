/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { ExplorePage } from './pages/ExplorePage';
import { CollectionPage } from './pages/CollectionPage';

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <div className="min-h-screen bg-[#f8fafc] font-sans text-gray-900">
            <Navbar />
            <main>
              <Routes>
                <Route path="/" element={<ExplorePage />} />
                <Route path="/collection" element={<CollectionPage />} />
              </Routes>
            </main>
          </div>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}
