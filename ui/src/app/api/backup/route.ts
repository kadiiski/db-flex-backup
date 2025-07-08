import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

export async function POST() {
  return new Promise<Response>((resolve) => {
    const proc = spawn('backup', ['backup'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(NextResponse.json({ message: 'Backup generated successfully.' }));
      } else {
        console.error('Backup error:', output);
        resolve(NextResponse.json({ error: 'Failed to create backup.' }, { status: 500 }));
      }
    });
  });
} 