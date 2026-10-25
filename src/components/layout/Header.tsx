'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PlusCircle, ExternalLink, Menu, X, Bot, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface HeaderProps {
  onToggleMobileNav?: () => void;
}

export function Header({ onToggleMobileNav }: HeaderProps) {
  const pathname = usePathname();

  const getPageTitle = (path: string) => {
    if (path === '/') return 'System Overview';
    if (path.startsWith('/new')) return 'New Workflow Task';
    if (path.startsWith('/history')) return 'Execution History';
    if (path.startsWith('/evaluations')) return 'Benchmark Evaluations';
    if (path.startsWith('/settings')) return 'Settings & Configuration';
    if (path.startsWith('/demo/learning-portal')) return 'Student Learning Portal (Demo)';
    return 'Dashboard';
  };

  const isDemoPortal = pathname.startsWith('/demo/learning-portal');

  return (
    <header className="h-16 border-b border-zinc-800/80 bg-zinc-950/70 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between sticky top-0 z-20">
      <div className="flex items-center gap-3">
        {onToggleMobileNav && (
          <button
            onClick={onToggleMobileNav}
            className="md:hidden p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60"
            aria-label="Toggle Navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight text-zinc-100">
              {getPageTitle(pathname)}
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
              <ShieldCheck className="h-3 w-3 text-cyan-400" />
              Isolated Local Environment
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {!isDemoPortal && (
          <>
            <Link href="/demo/learning-portal" className="hidden lg:inline-flex">
              <Button variant="outline" size="sm">
                <span>View Demo Portal</span>
                <ExternalLink className="h-3.5 w-3.5 text-zinc-400" />
              </Button>
            </Link>
            <Link href="/new">
              <Button variant="primary" size="sm">
                <PlusCircle className="h-4 w-4" />
                <span>New Workflow</span>
              </Button>
            </Link>
          </>
        )}

        {isDemoPortal && (
          <Link href="/">
            <Button variant="outline" size="sm">
              <Bot className="h-4 w-4 text-cyan-400" />
              <span>Back to FlowPilot</span>
            </Button>
          </Link>
        )}
      </div>
    </header>
  );
}
