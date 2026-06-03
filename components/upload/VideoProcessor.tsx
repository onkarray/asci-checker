'use client';

import { useState, useRef, useCallback } from 'react';
import { Progress } from '@/components/ui/progress';
import { Provider } from '@/components/analysis/ProviderRouter';
import { AdContent } from './AdUploader';

type VideoContent = Omit<AdContent, 'format'>;

interface VideoProcessorProps {
  provider: Provider;
  onProcessed: (content: VideoContent | null) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function VideoProcessor({ provider, onProcessed }: VideoProcessorProps) {
  const [status, setStatus] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [processed, setProcessed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processVideo = useCallback(
    async (file: File) => {
      if (file.size > 500 * 1024 * 1024) {
        alert('File too large. Max 500MB.');
        return;
      }

      setFileName(file.name);
      setProgress(5);

      if (provider === 'gemini') {
        setStatus('Gemini will process your video natively');
        setProgress(50);
        const base64 = await fileToBase64(file);
        setProgress(100);
        setProcessed(true);
        onProcessed({ videoBase64: base64, videoMimeType: file.type });
        return;
      }

      // Claude or OpenAI — use FFmpeg WASM
      setStatus('Extracting keyframes and audio...');
      setProgress(10);

      try {
        const { FFmpeg } = await import('@ffmpeg/ffmpeg');
        const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

        const ffmpeg = new FFmpeg();

        const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
        await ffmpeg.load({
          coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
          wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
        });

        setProgress(20);
        setStatus('Loading video...');

        await ffmpeg.writeFile('input.mp4', await fetchFile(file));

        setProgress(30);
        setStatus('Extracting keyframes...');

        // Extract frames at scene changes + beginning + end
        // Get video duration first via probe
        const frames: Array<{ base64: string; timestamp: number }> = [];

        // Extract frames: 0s, 1s, 2s, 3s (disclosure check)
        for (let t = 0; t <= 3; t++) {
          await ffmpeg.exec([
            '-ss', String(t),
            '-i', 'input.mp4',
            '-vframes', '1',
            '-vf', 'scale=1280:-1',
            '-f', 'image2',
            `frame_${t.toString().padStart(3, '0')}.jpg`,
          ]);
          try {
            const data = await ffmpeg.readFile(`frame_${t.toString().padStart(3, '0')}.jpg`) as Uint8Array;
            const b64 = btoa(String.fromCharCode(...data));
            frames.push({ base64: b64, timestamp: t });
          } catch {}
        }

        setProgress(50);
        setStatus('Extracting scene change frames...');

        // Scene change detection frames
        await ffmpeg.exec([
          '-i', 'input.mp4',
          '-vf', 'select=gt(scene\\,0.3),scale=1280:-1',
          '-vsync', 'vfr',
          '-vframes', '14',
          'scene_%03d.jpg',
        ]);

        for (let i = 1; i <= 14; i++) {
          try {
            const data = await ffmpeg.readFile(`scene_${String(i).padStart(3, '0')}.jpg`) as Uint8Array;
            const b64 = btoa(String.fromCharCode(...data));
            frames.push({ base64: b64, timestamp: -1 }); // timestamp unknown for scene frames
          } catch {}
        }

        // Limit to 20 total frames
        const limitedFrames = frames.slice(0, 20);

        setProgress(65);
        setStatus('Extracting audio for transcription...');

        let transcript = '';
        try {
          await ffmpeg.exec([
            '-i', 'input.mp4',
            '-vn',
            '-acodec', 'libmp3lame',
            '-q:a', '4',
            'audio.mp3',
          ]);

          const audioData = await ffmpeg.readFile('audio.mp3') as Uint8Array;
          const audioBase64 = btoa(String.fromCharCode(...audioData));

          setProgress(75);
          setStatus('Transcribing audio...');

          const { transcribeAudio } = await import('@/components/analysis/ProviderRouter');
          const apiKey = localStorage.getItem('asci_api_key') || '';
          transcript = await transcribeAudio(audioBase64, 'audio/mpeg', apiKey, provider);
        } catch (err) {
          console.warn('Audio transcription failed:', err);
          transcript = '[Audio transcription unavailable]';
        }

        setProgress(95);
        setStatus(`${limitedFrames.length} frames extracted, transcript ready`);

        setProcessed(true);
        onProcessed({
          videoFrames: limitedFrames,
          videoTranscript: transcript,
        });

        setProgress(100);
      } catch (err) {
        console.error('FFmpeg processing error:', err);
        setStatus('Error processing video. Sending as-is...');
        const base64 = await fileToBase64(file);
        setProcessed(true);
        onProcessed({ videoBase64: base64, videoMimeType: file.type });
      }
    },
    [provider, onProcessed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processVideo(file);
    },
    [processVideo]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processVideo(file);
  };

  return (
    <div className="space-y-4">
      {provider === 'gemini' && (
        <div className="text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded px-3 py-2">
          Gemini processes video natively — no preprocessing needed.
        </div>
      )}
      {(provider === 'claude' || provider === 'openai') && (
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Tip: Gemini processes video natively and gives better results for video ads.
        </div>
      )}

      {!processed && (
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
          }`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept="video/mp4,video/quicktime,video/avi,video/webm"
            className="hidden"
            onChange={handleChange}
          />
          <div className="flex flex-col items-center gap-2">
            <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
            <p className="text-sm font-medium">Drop your video here or click to browse</p>
            <p className="text-xs text-muted-foreground">MP4, MOV, AVI, WebM — max 500MB</p>
          </div>
        </div>
      )}

      {status && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{fileName}</span>
            <span>{status}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}
    </div>
  );
}
