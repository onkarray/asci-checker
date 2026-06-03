import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const file = searchParams.get('file');

  if (!file || !/^[\w.-]+\.txt$/.test(file)) {
    return new NextResponse('Invalid file', { status: 400 });
  }

  const promptsDir = path.join(process.cwd(), 'prompts');
  const filePath = path.join(promptsDir, file);

  // Prevent directory traversal
  if (!filePath.startsWith(promptsDir)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return new NextResponse(content, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
