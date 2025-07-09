import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { writeFile, unlink } from 'fs/promises';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    // Check gzip magic number (1f 8b)
    if (!(buffer[0] === 0x1f && buffer[1] === 0x8b)) {
      return NextResponse.json({ error: 'File is not a valid .gz archive' }, { status: 400 });
    }
    const tempName = `/tmp/upload_${randomBytes(8).toString('hex')}`;
    await writeFile(tempName, buffer);
    const result = await new Promise<{ code: number; output: string }>((resolve) => {
      const proc = spawn('backup', ['upload', tempName], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        resolve({ code: code ?? 1, output });
      });
    });
    await unlink(tempName);
    if (result.code !== 0) {
      console.error('Failed to upload backup.', result.output);
      return NextResponse.json({ error: result.output || 'Failed to upload backup.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Backup uploaded successfully.' });
  } catch (err) {
    console.error('Failed to upload backup.', err);
    return NextResponse.json({ error: 'Failed to upload backup.' }, { status: 500 });
  }
} 