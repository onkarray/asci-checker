'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import AdUploader, { AdContent, AdFormat } from '@/components/upload/AdUploader';
import AnalysisRunner, { AnalysisResult } from '@/components/analysis/AnalysisRunner';
import TeaserCard from '@/components/results/TeaserCard';
import EmailGate from '@/components/results/EmailGate';
import FullReport from '@/components/results/FullReport';
import {
  detectProvider,
  getDefaultModel,
  getProviderName,
  getProviderSignupUrl,
  PROVIDER_MODELS,
  Provider,
} from '@/components/analysis/ProviderRouter';

const AD_FORMATS: { value: AdFormat; label: string }[] = [
  { value: 'text', label: 'Text/Script' },
  { value: 'image', label: 'Single Image' },
  { value: 'carousel', label: 'Carousel' },
  { value: 'video', label: 'Video' },
];

const CATEGORIES = [
  'Personal Care',
  'Healthcare / Supplements',
  'Food & Beverages',
  'Education / EdTech',
  'Real Estate',
  'Finance / Investment',
  'Crypto / NFTs',
  'Fashion & Lifestyle',
  'Automotive',
  'Other',
];

const CONTENT_TYPES = [
  'Brand Ad',
  'Influencer Post',
  'Brand Ad featuring Influencer',
];

const PLATFORMS = [
  'Instagram',
  'YouTube',
  'Facebook',
  'LinkedIn',
  'Twitter/X',
  'TV',
  'Print',
  'Outdoor/OOH',
  'Website',
  'Other',
];

type AppState = 'form' | 'analyzing' | 'teaser' | 'full_report';

export default function CheckPage() {
  const [apiKey, setApiKey] = useState('');
  const [provider, setProvider] = useState<Provider>(null);
  const [model, setModel] = useState('');
  const [geminiModels, setGeminiModels] = useState<{ value: string; label: string }[]>([]);
  const [geminiModelsLoading, setGeminiModelsLoading] = useState(false);
  const [adFormat, setAdFormat] = useState<AdFormat>('text');
  const [category, setCategory] = useState('');
  const [contentType, setContentType] = useState('');
  const [platform, setPlatform] = useState('');
  const [adContent, setAdContent] = useState<AdContent | null>(null);
  const [appState, setAppState] = useState<AppState>('form');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState('');
  const [isUnlocked, setIsUnlocked] = useState(false);

  const emailGateRef = useRef<HTMLDivElement>(null);

  const fetchGeminiModels = async (key: string) => {
    setGeminiModelsLoading(true);
    setGeminiModels([]);
    setModel('');
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`
      );
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      const available = (data.models as Array<{ name: string; supportedGenerationMethods: string[] }>)
        .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
        .map(m => {
          const id = m.name.replace('models/', '');
          return { value: id, label: id };
        });
      setGeminiModels(available);
      if (available.length > 0) setModel(available[0].value);
    } catch {
      // Fall back to static list if fetch fails
      setGeminiModels(PROVIDER_MODELS.gemini);
      setModel(PROVIDER_MODELS.gemini[0].value);
    } finally {
      setGeminiModelsLoading(false);
    }
  };

  useEffect(() => {
    const stored = localStorage.getItem('asci_api_key');
    if (stored) {
      setApiKey(stored);
      const p = detectProvider(stored);
      setProvider(p);
      if (p === 'gemini') {
        fetchGeminiModels(stored);
      } else if (p) {
        setModel(getDefaultModel(p));
      }
    }
    const stored_analysis = sessionStorage.getItem('asci_analysis');
    if (stored_analysis) {
      try {
        const parsed = JSON.parse(stored_analysis);
        parsed.violations = parsed.violations ?? [];
        parsed.compliant_elements = parsed.compliant_elements ?? [];
        setAnalysisResult(parsed);
        setAppState('teaser');
      } catch {}
    }
  }, []);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const key = e.target.value.trim();
    setApiKey(key);
    const p = detectProvider(key);
    setProvider(p);
    if (key) {
      localStorage.setItem('asci_api_key', key);
    } else {
      localStorage.removeItem('asci_api_key');
    }
    if (p === 'gemini' && key.length > 10) {
      fetchGeminiModels(key);
    } else if (p) {
      setModel(getDefaultModel(p));
    } else {
      setModel('');
    }
  };

  const canRun =
    apiKey.trim() !== '' &&
    provider !== null &&
    !geminiModelsLoading &&
    model.trim() !== '' &&
    category !== '' &&
    contentType !== '' &&
    platform !== '' &&
    adContent !== null;

  const handleRunAnalysis = () => {
    setAnalysisError('');
    setAppState('analyzing');
  };

  const handleAnalysisComplete = (result: AnalysisResult) => {
    setAnalysisResult(result);
    setAppState('teaser');
  };

  const handleAnalysisError = (err: string) => {
    setAnalysisError(err);
    setAppState('form');
  };

  const handleUnlockClick = () => {
    emailGateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleUnlocked = () => {
    setIsUnlocked(true);
    setAppState('full_report');
  };

  const handleCheckAnother = () => {
    setAdContent(null);
    setAnalysisResult(null);
    setIsUnlocked(false);
    setAppState('form');
    setAnalysisError('');
    sessionStorage.removeItem('asci_analysis');
  };

  if (appState === 'analyzing' && adContent) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="border-b px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">ASCI Checker</Link>
        </nav>
        <div className="max-w-2xl mx-auto px-4 py-16">
          <h1 className="text-2xl font-bold text-center mb-8">Analyzing your ad...</h1>
          <AnalysisRunner
            adContent={adContent}
            apiKey={apiKey}
            provider={provider}
            model={model}
            adFormat={adFormat}
            adCategory={category}
            contentType={contentType}
            platform={platform}
            onComplete={handleAnalysisComplete}
            onError={handleAnalysisError}
          />
        </div>
      </div>
    );
  }

  if ((appState === 'teaser' || appState === 'full_report') && analysisResult) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="border-b px-4 py-3 flex items-center justify-between">
          <Link href="/" className="font-bold text-lg">ASCI Checker</Link>
          <button
            onClick={handleCheckAnother}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Check another ad
          </button>
        </nav>
        <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
          {!isUnlocked ? (
            <>
              <TeaserCard result={analysisResult} onUnlockClick={handleUnlockClick} />
              <EmailGate
                ref={emailGateRef}
                result={analysisResult}
                adCategory={category}
                adFormat={adFormat}
                platform={platform}
                provider={provider}
                onUnlocked={handleUnlocked}
              />
            </>
          ) : (
            <FullReport
              result={analysisResult}
              adCategory={category}
              adFormat={adFormat}
              platform={platform}
              onCheckAnother={handleCheckAnother}
            />
          )}
        </div>
      </div>
    );
  }

  // Form state
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-lg">ASCI Checker</Link>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">Check your ad for ASCI compliance</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Your ad is analyzed in your browser using your own API key. We never see your creative.
          </p>
        </div>

        {analysisError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-800 text-sm">
            <strong>Analysis failed:</strong> {analysisError}
          </div>
        )}

        {/* Step 1: API Key */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">1</div>
              <h2 className="font-semibold">Your API Key</h2>
            </div>
            <div className="space-y-2">
              <Label htmlFor="apiKey">Paste your API key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-ant-... or sk-... or AIza..."
                value={apiKey}
                onChange={handleApiKeyChange}
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Your key is stored only in your browser. Never sent to our servers.
                Used only to call the AI model for analysis.
              </p>
              {provider && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm bg-slate-50 border rounded px-3 py-2">
                    <span className="font-medium text-green-700">
                      Detected: {getProviderName(provider)}
                    </span>
                    <a
                      href={getProviderSignupUrl(provider)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline"
                    >
                      Get a free API key
                    </a>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="model">Model</Label>
                    {provider === 'gemini' ? (
                      geminiModelsLoading ? (
                        <p className="text-xs text-muted-foreground">Fetching available models...</p>
                      ) : (
                        <Select value={model} onValueChange={setModel}>
                          <SelectTrigger id="model">
                            <SelectValue placeholder="Select a model" />
                          </SelectTrigger>
                          <SelectContent>
                            {geminiModels.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )
                    ) : (
                      <Select value={model} onValueChange={setModel}>
                        <SelectTrigger id="model">
                          <SelectValue placeholder="Select a model" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROVIDER_MODELS[provider].map(m => (
                            <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}
              {!provider && apiKey.length > 5 && (
                <p className="text-xs text-destructive">
                  Unrecognized API key format. Expected: sk-ant- (Claude), sk- (OpenAI), or AIza (Gemini)
                </p>
              )}
              {(adFormat === 'video') && provider && provider !== 'gemini' && (
                <div className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded px-3 py-2">
                  Tip: Gemini processes video natively and gives better results for video ads.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Ad Details */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">2</div>
              <h2 className="font-semibold">Ad Details</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Ad Format *</Label>
                <Select value={adFormat} onValueChange={v => { setAdFormat(v as AdFormat); setAdContent(null); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent>
                    {AD_FORMATS.map(f => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Primary Category *</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Content Type *</Label>
                <Select value={contentType} onValueChange={setContentType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select content type" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map(ct => (
                      <SelectItem key={ct} value={ct}>{ct}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Platform *</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Ad Content */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">3</div>
              <h2 className="font-semibold">Upload Ad Content</h2>
            </div>
            <AdUploader
              format={adFormat}
              provider={provider}
              onContentChange={setAdContent}
            />
          </CardContent>
        </Card>

        {/* Step 4: Run */}
        <button
          onClick={handleRunAnalysis}
          disabled={!canRun}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-xl text-base transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Check My Ad
        </button>

        {!canRun && (
          <p className="text-xs text-center text-muted-foreground">
            Enter your API key, fill all fields, and upload your ad to continue.
          </p>
        )}
      </div>
    </div>
  );
}
