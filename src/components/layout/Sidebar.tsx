'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  BarChart3,
  Settings,
  GraduationCap,
  ExternalLink,
  Bot,
  Layers,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const mainNavItems: NavItem[] = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'New Workflow', href: '/new', icon: PlusCircle },
  { name: 'Run History', href: '/history', icon: History },
  { name: 'Evaluations', href: '/evaluations', icon: BarChart3, badge: 'Benchmarks' },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 border-r border-zinc-800/80 bg-zinc-950 flex flex-col h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-tr from-cyan-600 via-cyan-500 to-indigo-500 flex items-center justify-center text-zinc-950 shadow-md shadow-cyan-500/20 group-hover:scale-105 transition-transform">
            <Bot className="h-5 w-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-zinc-100">FlowPilot</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/90 text-cyan-400 border border-zinc-700/60 font-medium">
                v0.1
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-normal">Browser Workflow Agent</p>
          </div>
        </Link>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase font-mono">
            Platform
          </div>
          <nav className="space-y-1">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all group',
                    isActive
                      ? 'bg-zinc-800/90 text-cyan-400 shadow-sm border border-zinc-700/60'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70 border border-transparent'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={cn(
                        'h-4 w-4 transition-colors',
                        isActive ? 'text-cyan-400' : 'text-zinc-400 group-hover:text-zinc-200'
                      )}
                    />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <Badge variant={isActive ? 'info' : 'neutral'} size="sm">
                      {item.badge}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Demo Test Targets Section */}
        <div>
          <div className="px-3 mb-2 text-[10px] font-semibold tracking-wider text-zinc-400 uppercase font-mono flex items-center justify-between">
            <span>Testbed Targets</span>
            <span className="text-[9px] text-zinc-400 lowercase">local</span>
          </div>
          <div className="space-y-1">
            <Link
              href="/demo/learning-portal"
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all group border',
                pathname.startsWith('/demo/learning-portal')
                  ? 'bg-indigo-950/40 text-indigo-300 border-indigo-800/50'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/70 border-zinc-800/40'
              )}
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="h-4 w-4 text-indigo-400 group-hover:text-indigo-300 transition-colors" />
                <div className="text-left">
                  <div className="leading-none font-medium">Learning Portal</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Deterministic benchmark</div>
                </div>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400 group-hover:text-zinc-400 transition-colors" />
            </Link>
          </div>
        </div>

        {/* Technical Architecture Info Box */}
        <div className="px-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
              <Layers className="h-3.5 w-3.5 text-cyan-400" />
              <span>Placement Portfolio</span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Step 1: UI Foundation & Deterministic Benchmark Target. Agent backend (Playwright + LLM) connects in Step 2.
            </p>
          </div>
        </div>
      </div>

      {/* Footer / Status Indicator */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/80 text-[11px] text-zinc-400">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-60"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
            <span className="font-mono text-zinc-400">UI Foundation</span>
          </div>
          <span className="font-mono text-[10px] text-zinc-400">Sandbox: Safe</span>
        </div>
      </div>
    </aside>
  );
}
