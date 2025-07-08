import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }
    const result = await new Promise<{ code: number; output: string }>((resolve) => {
      const proc = spawn('backup', ['restore', filename], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        resolve({ code: code ?? 1, output });
      });
    });
    if (result.code !== 0) {
      console.error('Failed to restore backup.', result.output);
      return NextResponse.json({ error: 'Failed to restore backup.' }, { status: 500 });
    }
    return NextResponse.json({ message: 'Backup restored successfully.' });
  } catch (err) {
    console.error('Failed to restore backup.', err);
    return NextResponse.json({ error: 'Failed to restore backup.' }, { status: 500 });
  }
} 