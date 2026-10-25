'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowRight, CornerDownLeft, Globe } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface QuickStartInputProps {
  initialValue?: string;
}

export const SUGGESTED_PROMPTS = [
  {
    label: 'Workflow A: 7-Day Incomplete Checklist',
    prompt: 'Find all incomplete assignments due in the next 7 days on the demo learning portal and prepare a prioritized checklist.',
    target: 'http://localhost:3000/demo/learning-portal'
  },
  {
    label: 'Workflow B: Course Progress Summary',
    prompt: 'Extract the available courses and summarize the assignment count and completion status for each course.',
    target: 'http://localhost:3000/demo/learning-portal'
  },
  {
    label: 'Workflow C: Overdue Assignments Audit',
    prompt: 'Find incomplete assignments whose due dates are before the current reference date and produce an overdue checklist.',
    target: 'http://localhost:3000/demo/learning-portal'
  }
];

export function QuickStartInput({ initialValue = '' }: QuickStartInputProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    router.push(`/new?prompt=${encodeURIComponent(prompt.trim())}`);
  };

  const handleSelectSuggestion = (selectedPrompt: string) => {
    router.push(`/new?prompt=${encodeURIComponent(selectedPrompt)}`);
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-gradient-to-b from-zinc-900/90 to-zinc-900/40 p-5 shadow-lg relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-0 right-0 -mt-10 -mr-10 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-2 mb-3">
        <div className="h-6 w-6 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-100">Quick-Start Autonomous Browser Workflow</h3>
        <span className="text-[10px] font-mono uppercase bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
          Natural Language
        </span>
      </div>

      <form onSubmit={handleSubmit} className="relative mb-3">
        <textarea
          rows={2}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Find all incomplete assignments due in the next 7 days on the demo learning portal and prepare a prioritized checklist..."
          className="w-full bg-zinc-950/80 border border-zinc-700/80 rounded-lg p-3 text-xs sm:text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 resize-none pr-24 font-normal"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
        />
        <div className="absolute right-2.5 bottom-3.5 flex items-center gap-1.5">
          <Button
            type="submit"
            size="sm"
            disabled={!prompt.trim()}
            className="text-xs h-7 px-3"
          >
            <span>Plan Workflow</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </form>

      {/* Suggested Chips */}
      <div>
        <div className="text-[11px] font-medium text-zinc-400 mb-2 flex items-center gap-1.5">
          <span>Preset Verification Benchmarks:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_PROMPTS.map((item, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSelectSuggestion(item.prompt)}
              className="text-left text-xs bg-zinc-950/70 hover:bg-zinc-800/80 text-zinc-300 hover:text-cyan-300 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 group"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/80 group-hover:scale-125 transition-transform" />
              <span>{item.label}</span>
              <CornerDownLeft className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
