import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Leaf, BookOpen, LogIn, LogOut } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Navbar() {
  const { user, signInWithGoogle, logout } = useAuth();
  const location = useLocation();

  return (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-green-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="bg-green-100 p-2 rounded-xl group-hover:bg-green-200 transition-colors">
                <Leaf className="w-6 h-6 text-green-600" />
              </div>
              <span className="font-bold text-xl text-green-900 tracking-tight">生態圖鑑 (Wildlife Field Guide)V3.0</span>
            </Link>
            
            <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
              <Link
                to="/"
                className={cn(
                  "inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === '/' 
                    ? "bg-green-50 text-green-700" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                探索生物
              </Link>
              {user && (
                <Link
                  to="/collection"
                  className={cn(
                    "inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === '/collection' 
                      ? "bg-green-50 text-green-700" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  )}
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  我的蒐集
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                    alt="Profile" 
                    className="w-8 h-8 rounded-full border border-green-200"
                  />
                  <span className="text-sm font-medium text-gray-700">{user.displayName}</span>
                </div>
                <button
                  onClick={logout}
                  className="inline-flex items-center justify-center p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  title="登出"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-xl shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all active:scale-95"
              >
                <LogIn className="w-4 h-4 mr-2" />
                Google 登入
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Mobile nav */}
      <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-2 flex gap-2 overflow-x-auto">
        <Link
          to="/"
          className={cn(
            "inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap",
            location.pathname === '/' 
              ? "bg-green-50 text-green-700" 
              : "text-gray-600 hover:bg-gray-50"
          )}
        >
          探索生物
        </Link>
        {user && (
          <Link
            to="/collection"
            className={cn(
              "inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap",
              location.pathname === '/collection' 
                ? "bg-green-50 text-green-700" 
                : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            我的蒐集
          </Link>
        )}
      </div>
    </nav>
  );
}
