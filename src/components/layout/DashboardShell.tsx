'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { X } from 'lucide-react';

interface DashboardShellProps {
  children: React.ReactNode;
}

export function DashboardShell({ children }: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
      {/* Mobile Drawer Backdrop */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setMobileNavOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 transform md:hidden transition-transform duration-200 ease-in-out ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="relative h-full flex flex-col">
          <button
            onClick={() => setMobileNavOpen(false)}
            className="absolute top-4 right-4 z-50 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 bg-zinc-900 border border-zinc-800"
            aria-label="Close Navigation"
          >
            <X className="h-4 w-4" />
          </button>
          <Sidebar />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div className="hidden md:block">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header onToggleMobileNav={() => setMobileNavOpen((prev) => !prev)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
