'use client';

import React, { useState } from 'react';
import {
  Settings,
  Cpu,
  Key,
  Shield,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sliders,
  Camera,
  Server
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export default function SettingsPage() {
  const [provider, setProvider] = useState('openai');
  const [model, setModel] = useState('gpt-4o');
  const [headless, setHeadless] = useState(true);
  const [maxSteps, setMaxSteps] = useState(15);
  const [timeoutSec, setTimeoutSec] = useState(30);
  const [defaultUrl, setDefaultUrl] = useState('http://localhost:3000/demo/learning-portal');
  const [recordTraces, setRecordTraces] = useState(true);
  const [saveScreenshots, setSaveScreenshots] = useState(true);
  const [saveNotice, setSaveNotice] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveNotice(true);
    setTimeout(() => setSaveNotice(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          <span>Engine Settings & Orchestration</span>
          <Badge variant="neutral" size="sm">Configuration</Badge>
        </h2>
        <p className="text-xs sm:text-sm text-zinc-400 mt-1">
          Configure model parameters, browser execution sandboxing, and telemetry recording preferences.
        </p>
      </div>

      {saveNotice && (
        <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>Configuration preferences updated successfully for this session.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 1: Agent & LLM Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>Model Provider & Reasoning Planner</span>
            </CardTitle>
            <CardDescription>
              Select the LLM backend responsible for decomposing natural language instructions into browser actions.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  LLM Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="gemini">Google DeepMind (Gemini 1.5 Pro)</option>
                  <option value="ollama">Local Self-Hosted (Ollama / Qwen2.5-Coder)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Model Identifier
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* API Key Security Notice */}
            <div className="p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                  <Key className="h-3.5 w-3.5 text-amber-400" />
                  <span>API Key Resolution (Security Safe Placeholder)</span>
                </label>
                <Badge variant="warning" size="sm">Server-Side Only</Badge>
              </div>

              <div className="relative">
                <input
                  type="password"
                  disabled
                  value="sk-antigravity-mock-secret-placeholder-key-safe"
                  readOnly
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs font-mono text-zinc-500 cursor-not-allowed select-none"
                />
              </div>

              <p className="text-[11px] text-zinc-500 leading-relaxed">
                <strong className="text-zinc-400">Security Rule:</strong> FlowPilot strictly prevents exposing secret credentials in client-side code. API keys must reside in server-side environment variables (<code className="text-zinc-400">process.env.GEMINI_API_KEY</code>) and are never dispatched to client browsers. If no key is set, FlowPilot operates in deterministic fallback mode.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Browser Engine Sandboxing */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-cyan-400" />
              <span>Browser Automation & Sandboxing</span>
            </CardTitle>
            <CardDescription>
              Configure headless execution limits, safety timeouts, and default target endpoints.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Max Steps Limit per Task
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={maxSteps}
                  onChange={(e) => setMaxSteps(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Prevents infinite navigation loops (Default: 15)
                </span>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                  Action Timeout (Seconds)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={timeoutSec}
                  onChange={(e) => setTimeoutSec(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  Per-action DOM locator timeout (Default: 30s)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Default Target Website URL
              </label>
              <input
                type="text"
                value={defaultUrl}
                onChange={(e) => setDefaultUrl(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-700/80 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-zinc-800">
              <div>
                <div className="text-xs font-medium text-zinc-200">Headless Chromium Execution</div>
                <div className="text-[11px] text-zinc-500">
                  Run browser invisibly in the background. Disable for visual inspection.
                </div>
              </div>
              <input
                type="checkbox"
                checked={headless}
                onChange={(e) => setHeadless(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Telemetry & Traces */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <Camera className="h-4 w-4 text-cyan-400" />
              <span>Artifacts & Playwright Traces</span>
            </CardTitle>
            <CardDescription>
              Control recording of DOM traces and visual evidence for verification audits.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-zinc-200">Record Step Screenshots</div>
                <div className="text-[11px] text-zinc-500">
                  Capture PNG snapshots before and after DOM state changes.
                </div>
              </div>
              <input
                type="checkbox"
                checked={saveScreenshots}
                onChange={(e) => setSaveScreenshots(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <div>
                <div className="text-xs font-medium text-zinc-200">Save Playwright Trace Archives (.zip)</div>
                <div className="text-[11px] text-zinc-500">
                  Full execution timeline replayable in Playwright Trace Viewer.
                </div>
              </div>
              <input
                type="checkbox"
                checked={recordTraces}
                onChange={(e) => setRecordTraces(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 text-cyan-500 focus:ring-cyan-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Form Submit */}
        <div className="flex items-center justify-end gap-3">
          <Button type="submit" variant="primary" size="md">
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
