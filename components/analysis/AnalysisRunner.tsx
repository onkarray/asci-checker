'use client';

import { useState, useEffect, useRef } from 'react';
import { Progress } from '@/components/ui/progress';
import { callProvider, Provider } from './ProviderRouter';
import { AdContent } from '@/components/upload/AdUploader';
import { jsonrepair } from 'jsonrepair';

export interface AnalysisResult {
  overall_score: number;
  verdict: 'COMPLIANT' | 'NEEDS_REVISION' | 'NON_COMPLIANT' | 'AUTO_FAIL';
  auto_fail_reason: string | null;
  escalation_required: boolean;
  escalation_body: string | null;
  category_scores: {
    claim_substantiation: number;
    disclosure_compliance: number;
    prohibited_category_check: number;
    sector_specific: number;
    language_and_framing: number;
  };
  violations: Array<{
    id: string;
    module: string;
    rule_reference: string;
    severity: 'HIGH' | 'MEDIUM' | 'LOW';
    offending_element: string;
    why_its_a_violation: string;
    fix_suggestion: string;
  }>;
  compliant_elements: string[];
  teaser_summary: string;
  full_summary: string;
}

interface AnalysisRunnerProps {
  adContent: AdContent;
  apiKey: string;
  provider: Provider;
  model: string;
  adFormat: string;
  adCategory: string;
  contentType: string;
  platform: string;
  onComplete: (result: AnalysisResult) => void;
  onError: (error: string) => void;
}

const STATUS_MESSAGES = [
  'Reading your ad copy...',
  'Checking claim substantiation rules...',
  'Reviewing disclosure compliance...',
  'Applying sector-specific guidelines...',
  'Calculating your compliance score...',
];

const FORMAT_MAP: Record<string, string> = {
  text: 'TEXT',
  image: 'IMAGE',
  carousel: 'CAROUSEL',
  video: 'VIDEO_TRANSCRIPT_WITH_FRAMES',
};

const SECTOR_MAP: Record<string, string> = {
  'Personal Care': 'personal_care',
  'Healthcare / Supplements': 'healthcare',
  'Food & Beverages': 'food_beverage',
  'Education / EdTech': 'education',
  'Real Estate': 'real_estate',
  'Finance / Investment': 'finance',
  'Crypto / NFTs': 'crypto',
  'Fashion & Lifestyle': 'fashion',
  'Automotive': 'automotive',
  'Other': 'general',
};

const PLATFORM_MAP: Record<string, string> = {
  'Instagram': 'instagram',
  'YouTube': 'youtube',
  'Facebook': 'facebook',
  'LinkedIn': 'linkedin',
  'Twitter/X': 'twitter',
  'TV': 'tv',
  'Print': 'print',
  'Outdoor/OOH': 'outdoor',
  'Website': 'website',
  'Other': 'other',
};

const CONTENT_TYPE_MAP: Record<string, string> = {
  'Brand Ad': 'brand_ad',
  'Influencer Post': 'influencer_post',
  'Brand Ad featuring Influencer': 'brand_ad_with_influencer',
};

async function loadPrompt(filename: string): Promise<string> {
  const response = await fetch(`/api/prompts?file=${filename}`);
  if (!response.ok) throw new Error(`Failed to load prompt: ${filename}`);
  return response.text();
}

function buildUserPrompt(
  systemTxt: string,
  analysisTxt: string,
  format: string,
  sector: string,
  contentType: string,
  platform: string,
  adContent: AdContent
): { prompt: string; images?: Array<{ base64: string; mimeType: string }> } {
  const formatVal = FORMAT_MAP[format] || format.toUpperCase();
  const sectorVal = SECTOR_MAP[sector] || 'general';
  const contentTypeVal = CONTENT_TYPE_MAP[contentType] || 'brand_ad';
  const platformVal = PLATFORM_MAP[platform] || 'other';

  const isCarousel = format === 'carousel';
  const isVideo = format === 'video';

  let contentBlock = '';
  const images: Array<{ base64: string; mimeType: string }> = [];

  if (format === 'text' && adContent.text) {
    contentBlock = adContent.text;
  } else if (format === 'image' && adContent.images) {
    contentBlock = '[Image provided above]';
    for (const img of adContent.images) {
      images.push({ base64: img.base64, mimeType: img.mimeType });
    }
  } else if (format === 'carousel' && adContent.images) {
    const frameDescriptions = adContent.images
      .map((img, idx) => `Frame ${idx + 1}: [Image ${idx + 1} provided above]`)
      .join('\n');
    contentBlock = frameDescriptions;
    for (const img of adContent.images) {
      images.push({ base64: img.base64, mimeType: img.mimeType });
    }
  } else if (format === 'video') {
    if (adContent.videoFrames && adContent.videoFrames.length > 0) {
      const frameDescs = adContent.videoFrames.map((f, i) => {
        const ts = f.timestamp >= 0 ? `@${f.timestamp}s` : `scene_${i + 1}`;
        return `Frame ${i + 1} [${ts}]: [Image ${i + 1} provided above]`;
      });
      contentBlock = `TRANSCRIPT:\n${adContent.videoTranscript || 'No transcript available'}\n\nFRAMES:\n${frameDescs.join('\n')}`;
      for (const frame of adContent.videoFrames) {
        images.push({ base64: frame.base64, mimeType: 'image/jpeg' });
      }
    } else {
      contentBlock = `[Native video provided — full video content for analysis]\nTranscript: ${adContent.videoTranscript || 'N/A'}`;
    }
  }

  let carouselNote = '';
  if (isCarousel) {
    carouselNote = `CAROUSEL NOTE: Analyze each frame individually AND check for cross-frame
consistency. A claim made in frame 1 must be substantiated by frame 3
if that's where the evidence appears. Misleading sequencing is itself
a violation.`;
  }

  let videoNote = '';
  if (isVideo) {
    videoNote = `VIDEO NOTE: Transcript contains spoken content. Frame descriptions contain
visual content at key moments. Analyze both together. Pay specific attention to:
- Disclosure label presence and timing in first 3 seconds
- Any on-screen text claims not spoken aloud
- Before/after visual sequences
- Disclaimer text at end — check if readable and held long enough
- Credential display if health/finance advice is given`;
  }

  const prompt = analysisTxt
    .replace('{{format}}', `${formatVal}`)
    .replace('{{sector}}', sectorVal)
    .replace('{{content_type}}', contentTypeVal)
    .replace('{{platform}}', platformVal)
    .replace('{{#if carousel}}\nCAROUSEL NOTE: Analyze each frame individually AND check for cross-frame\nconsistency. A claim made in frame 1 must be substantiated by frame 3\nif that\'s where the evidence appears. Misleading sequencing is itself\na violation.\n{{/if}}', carouselNote)
    .replace('{{#if video}}\nVIDEO NOTE: Transcript contains spoken content. Frame descriptions contain\nvisual content at key moments. Analyze both together. Pay specific attention to:\n- Disclosure label presence and timing in first 3 seconds\n- Any on-screen text claims not spoken aloud\n- Before/after visual sequences\n- Disclaimer text at end — check if readable and held long enough\n- Credential display if health/finance advice is given\n{{/if}}', videoNote)
    .replace('{{content}}', contentBlock);

  return { prompt, images: images.length > 0 ? images : undefined };
}

function parseAnalysisJSON(raw: string): AnalysisResult {
  let cleaned = raw.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }
  // Extract outermost JSON object (handles stray text before/after)
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }
  // Use jsonrepair to fix unescaped quotes, newlines in strings, etc.
  const repaired = jsonrepair(cleaned);
  const parsed = JSON.parse(repaired);
  // Normalize: ensure arrays are never undefined
  parsed.violations = parsed.violations ?? [];
  parsed.compliant_elements = parsed.compliant_elements ?? [];
  return parsed as AnalysisResult;
}

export default function AnalysisRunner({
  adContent,
  apiKey,
  provider,
  model,
  adFormat,
  adCategory,
  contentType,
  platform,
  onComplete,
  onError,
}: AnalysisRunnerProps) {
  const [progress, setProgress] = useState(0);
  const [statusIdx, setStatusIdx] = useState(0);
  const [overrideStatus, setOverrideStatus] = useState('');
  const progressRef = useRef<NodeJS.Timeout | null>(null);
  const statusRef = useRef<NodeJS.Timeout | null>(null);
  const hasRun = useRef(false);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    // Fake progress 0 → 90% over ~20s
    let p = 0;
    progressRef.current = setInterval(() => {
      p = Math.min(p + 100 / (20 * 10), 90);
      setProgress(p);
    }, 100);

    // Rotate status messages
    let si = 0;
    statusRef.current = setInterval(() => {
      si = (si + 1) % STATUS_MESSAGES.length;
      setStatusIdx(si);
    }, 4000);

    const run = async () => {
      try {
        const [systemTxt, analysisTxt] = await Promise.all([
          loadPrompt('system.txt'),
          loadPrompt('analysis_request.txt'),
        ]);

        const { prompt, images } = buildUserPrompt(
          systemTxt,
          analysisTxt,
          adFormat,
          adCategory,
          contentType,
          platform,
          adContent
        );

        const videoBase64 = adContent.videoBase64;
        const videoMimeType = adContent.videoMimeType;

        const raw = await callProvider(
          { systemPrompt: systemTxt, userPrompt: prompt, images, apiKey, provider, model },
          videoBase64,
          videoMimeType,
          (msg) => setOverrideStatus(msg)
        );

        const result = parseAnalysisJSON(raw);

        // Save to sessionStorage
        sessionStorage.setItem('asci_analysis', JSON.stringify(result));

        clearInterval(progressRef.current!);
        clearInterval(statusRef.current!);
        setProgress(100);
        onComplete(result);
      } catch (err) {
        clearInterval(progressRef.current!);
        clearInterval(statusRef.current!);
        onError(err instanceof Error ? err.message : 'Analysis failed');
      }
    };

    run();

    return () => {
      if (progressRef.current) clearInterval(progressRef.current);
      if (statusRef.current) clearInterval(statusRef.current);
    };
  }, []);

  return (
    <div className="space-y-4 py-8">
      <div className="text-center space-y-2">
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
        </div>
        <p className="text-sm font-medium">{overrideStatus || STATUS_MESSAGES[statusIdx]}</p>
        <p className="text-xs text-muted-foreground">{Math.round(progress)}%</p>
      </div>
      <Progress value={progress} className="h-2" />
    </div>
  );
}
