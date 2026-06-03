export type Provider = 'claude' | 'openai' | 'gemini' | null;

export function detectProvider(apiKey: string): Provider {
  if (!apiKey) return null;
  if (apiKey.startsWith('sk-ant')) return 'claude';
  if (apiKey.startsWith('sk-')) return 'openai';
  if (apiKey.startsWith('AIza')) return 'gemini';
  return null;
}

export function getProviderName(provider: Provider): string {
  switch (provider) {
    case 'claude': return 'Claude (Anthropic)';
    case 'openai': return 'OpenAI';
    case 'gemini': return 'Google Gemini';
    default: return 'Unknown';
  }
}

export interface ModelOption {
  value: string;
  label: string;
}

export const PROVIDER_MODELS: Record<NonNullable<Provider>, ModelOption[]> = {
  claude: [
    { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (Recommended)' },
    { value: 'claude-opus-4-6', label: 'Claude Opus 4.6 (Most capable)' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fastest)' },
  ],
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o (Recommended)' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Faster, cheaper)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  ],
  gemini: [
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Recommended — best for video + images)' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Faster, cheaper — good for text + images)' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Latest, experimental)' },
  ],
};

export function getDefaultModel(provider: Provider): string {
  if (!provider) return '';
  return PROVIDER_MODELS[provider][0].value;
}

export function getProviderSignupUrl(provider: Provider): string {
  switch (provider) {
    case 'claude': return 'https://console.anthropic.com/';
    case 'openai': return 'https://platform.openai.com/';
    case 'gemini': return 'https://aistudio.google.com/';
    default: return '#';
  }
}

export interface AnalysisRequest {
  systemPrompt: string;
  userPrompt: string;
  images?: Array<{ base64: string; mimeType: string }>;
  apiKey: string;
  provider: Provider;
  model: string;
}

async function callClaudeOnce(req: AnalysisRequest): Promise<Response> {
  const content: unknown[] = [];

  if (req.images && req.images.length > 0) {
    for (const img of req.images) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType, data: img.base64 },
      });
    }
  }
  content.push({ type: 'text', text: req.userPrompt });

  return fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': req.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: 8192,
      temperature: 0,
      system: req.systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  });
}

async function callClaude(req: AnalysisRequest): Promise<string> {
  const MAX_RETRIES = 3;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 8000));
    const response = await callClaudeOnce(req);
    if (response.status === 529 || response.status === 503) {
      continue;
    }
    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Claude API error ${response.status}: ${err}`);
    }
    const data = await response.json();
    return data.content[0].text;
  }
  throw new Error(`Claude is currently overloaded. Please try again in a minute, or switch to Gemini or OpenAI.`);
}

async function callOpenAI(req: AnalysisRequest): Promise<string> {
  const content: unknown[] = [];

  if (req.images && req.images.length > 0) {
    for (const img of req.images) {
      content.push({
        type: 'image_url',
        image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
      });
    }
  }
  content.push({ type: 'text', text: req.userPrompt });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: req.model,
      max_tokens: 8192,
      temperature: 0,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

const GEMINI_FALLBACK = 'gemini-1.5-flash';

async function geminiGenerateContent(
  model: string,
  apiKey: string,
  body: object
): Promise<Response> {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

async function callGemini(
  req: AnalysisRequest,
  videoBase64?: string,
  videoMimeType?: string,
  onStatusUpdate?: (msg: string) => void
): Promise<string> {
  const parts: unknown[] = [{ text: req.systemPrompt + '\n\n' + req.userPrompt }];

  if (videoBase64 && videoMimeType) {
    // Use inline_data to avoid CORS issues with the Files API resumable upload endpoint
    parts.push({ inline_data: { mime_type: videoMimeType, data: videoBase64 } });
  } else if (req.images && req.images.length > 0) {
    for (const img of req.images) {
      parts.push({ inline_data: { mime_type: img.mimeType, data: img.base64 } });
    }
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: { maxOutputTokens: 8192, temperature: 0 },
  };

  let response = await geminiGenerateContent(req.model, req.apiKey, requestBody);

  if (response.status === 404 && req.model !== GEMINI_FALLBACK) {
    // Model not found — try the stable fallback
    onStatusUpdate?.('Model not available. Retrying with gemini-1.5-flash...');
    response = await geminiGenerateContent(GEMINI_FALLBACK, req.apiKey, requestBody);
    if (!response.ok) {
      throw new Error(
        'No supported Gemini model found for your API key. Go to aistudio.google.com to check which models are enabled.'
      );
    }
  } else if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export async function callProvider(
  req: AnalysisRequest,
  videoBase64?: string,
  videoMimeType?: string,
  onStatusUpdate?: (msg: string) => void
): Promise<string> {
  switch (req.provider) {
    case 'claude':
      return callClaude(req);
    case 'openai':
      return callOpenAI(req);
    case 'gemini':
      return callGemini(req, videoBase64, videoMimeType, onStatusUpdate);
    default:
      throw new Error('Unknown provider');
  }
}

export async function transcribeAudio(
  audioBase64: string,
  audioMimeType: string,
  apiKey: string,
  provider: Provider
): Promise<string> {
  if (provider === 'openai') {
    const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
    const blob = new Blob([audioBytes], { type: audioMimeType });
    const formData = new FormData();
    formData.append('file', blob, 'audio.mp3');
    formData.append('model', 'whisper-1');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) throw new Error(`Whisper error: ${response.status}`);
    const data = await response.json();
    return data.text;
  }

  if (provider === 'gemini' || provider === 'claude') {
    const parts = [
      { text: 'Transcribe this audio accurately. Return only the transcript text.' },
      { inline_data: { mime_type: audioMimeType, data: audioBase64 } },
    ];

    // Always use gemini-1.5-pro for transcription (stable fallback)
    const response = await geminiGenerateContent(
      GEMINI_FALLBACK,
      apiKey,
      { contents: [{ parts }] }
    );

    if (!response.ok) throw new Error(`Gemini transcription error: ${response.status}`);
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  return '';
}
