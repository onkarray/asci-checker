'use client';

import { useState, useRef, useCallback } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Provider } from '@/components/analysis/ProviderRouter';
import VideoProcessor from './VideoProcessor';

export type AdFormat = 'text' | 'image' | 'carousel' | 'video';

export interface AdContent {
  format: AdFormat;
  text?: string;
  images?: Array<{ base64: string; mimeType: string; name: string }>;
  videoBase64?: string;
  videoMimeType?: string;
  videoFrames?: Array<{ base64: string; timestamp: number }>;
  videoTranscript?: string;
}

interface AdUploaderProps {
  format: AdFormat;
  provider: Provider;
  onContentChange: (content: AdContent | null) => void;
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

function TextUploader({ onChange }: { onChange: (text: string) => void }) {
  const [text, setText] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className="space-y-2">
      <Textarea
        placeholder="Paste your ad script, caption, or copy here..."
        className="min-h-[200px] resize-y"
        value={text}
        onChange={handleChange}
      />
      <p className="text-xs text-muted-foreground text-right">{text.length} characters</p>
    </div>
  );
}

function ImageDropZone({
  onFiles,
  multiple = false,
  label = 'Drop your image here or click to browse',
  accept = 'image/jpeg,image/png,image/webp,image/gif',
  maxSize = 10,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  label?: string;
  accept?: string;
  maxSize?: number;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files).filter(f =>
        accept.split(',').some(a => f.type === a)
      );
      if (files.length > 0) onFiles(files);
    },
    [accept, onFiles]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onFiles(Array.from(e.target.files));
  };

  return (
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
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={handleChange}
      />
      <div className="flex flex-col items-center gap-2">
        <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
        </svg>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">Max {maxSize}MB per file</p>
      </div>
    </div>
  );
}

function SingleImageUploader({ onChange }: { onChange: (images: AdContent['images']) => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [name, setName] = useState('');

  const handleFiles = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File too large. Max 10MB.');
      return;
    }
    const base64 = await fileToBase64(file);
    setPreview(`data:${file.type};base64,${base64}`);
    setName(file.name);
    onChange([{ base64, mimeType: file.type, name: file.name }]);
  };

  return (
    <div className="space-y-4">
      <ImageDropZone onFiles={handleFiles} />
      {preview && (
        <div className="relative inline-block">
          <img src={preview} alt={name} className="max-h-64 rounded-lg border object-contain" />
          <button
            className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-6 h-6 text-xs flex items-center justify-center"
            onClick={() => { setPreview(null); onChange(undefined); }}
          >
            ×
          </button>
          <p className="text-xs text-muted-foreground mt-1">{name}</p>
        </div>
      )}
    </div>
  );
}

function CarouselUploader({ onChange }: { onChange: (images: AdContent['images']) => void }) {
  const [images, setImages] = useState<Array<{ base64: string; mimeType: string; name: string; preview: string }>>([]);

  const handleFiles = async (files: File[]) => {
    const remaining = 10 - images.length;
    const toAdd = files.slice(0, remaining);
    const newImages = await Promise.all(
      toAdd.map(async f => {
        if (f.size > 10 * 1024 * 1024) throw new Error(`${f.name} is too large`);
        const base64 = await fileToBase64(f);
        return { base64, mimeType: f.type, name: f.name, preview: `data:${f.type};base64,${base64}` };
      })
    );
    const updated = [...images, ...newImages];
    setImages(updated);
    onChange(updated.map(({ base64, mimeType, name }) => ({ base64, mimeType, name })));
  };

  const remove = (idx: number) => {
    const updated = images.filter((_, i) => i !== idx);
    setImages(updated);
    onChange(updated.map(({ base64, mimeType, name }) => ({ base64, mimeType, name })));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const updated = [...images];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    setImages(updated);
    onChange(updated.map(({ base64, mimeType, name }) => ({ base64, mimeType, name })));
  };

  const moveDown = (idx: number) => {
    if (idx === images.length - 1) return;
    const updated = [...images];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    setImages(updated);
    onChange(updated.map(({ base64, mimeType, name }) => ({ base64, mimeType, name })));
  };

  return (
    <div className="space-y-4">
      {images.length < 10 && (
        <ImageDropZone
          onFiles={handleFiles}
          multiple
          label={`Drop up to ${10 - images.length} more images — drag to reorder`}
        />
      )}
      <p className="text-xs text-muted-foreground">
        We&apos;ll analyze each frame + the full sequence together
      </p>
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {images.map((img, idx) => (
            <div key={idx} className="relative group">
              <div className="relative">
                <Badge className="absolute top-1 left-1 z-10 text-xs px-1 py-0">{idx + 1}</Badge>
                <img src={img.preview} alt={img.name} className="w-24 h-24 object-cover rounded-lg border" />
                <button
                  className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => remove(idx)}
                >
                  ×
                </button>
              </div>
              <div className="flex gap-1 mt-1 justify-center">
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => moveUp(idx)}>↑</button>
                <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => moveDown(idx)}>↓</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdUploader({ format, provider, onContentChange }: AdUploaderProps) {
  const handleTextChange = (text: string) => {
    if (text.trim()) {
      onContentChange({ format: 'text', text });
    } else {
      onContentChange(null);
    }
  };

  const handleSingleImage = (images: AdContent['images']) => {
    if (images && images.length > 0) {
      onContentChange({ format: 'image', images });
    } else {
      onContentChange(null);
    }
  };

  const handleCarousel = (images: AdContent['images']) => {
    if (images && images.length > 0) {
      onContentChange({ format: 'carousel', images });
    } else {
      onContentChange(null);
    }
  };

  const handleVideo = (content: Omit<AdContent, 'format'> | null) => {
    if (content) {
      onContentChange({ format: 'video', ...content });
    } else {
      onContentChange(null);
    }
  };

  switch (format) {
    case 'text':
      return <TextUploader onChange={handleTextChange} />;
    case 'image':
      return <SingleImageUploader onChange={handleSingleImage} />;
    case 'carousel':
      return <CarouselUploader onChange={handleCarousel} />;
    case 'video':
      return <VideoProcessor provider={provider} onProcessed={handleVideo} />;
    default:
      return null;
  }
}
