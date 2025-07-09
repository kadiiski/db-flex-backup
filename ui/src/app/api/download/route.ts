import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { randomBytes } from 'crypto';
import { promises as fsPromises, unlink } from 'fs';

export async function POST(req: NextRequest) {
  try {
    const { filename } = await req.json();
    if (!filename) {
      return NextResponse.json({ error: 'Missing filename' }, { status: 400 });
    }
    const tempName = `/tmp/download_${randomBytes(8).toString('hex')}`;
    // Call utils.sh download_from_s3 <filename> <tempName>
    type ProcResult = { code: number; output: string };
    const result: ProcResult = await new Promise((resolve) => {
      const proc = spawn('backup', ['download', filename, tempName], { stdio: ['ignore', 'pipe', 'pipe'] });
      let output = '';
      proc.stdout.on('data', (data) => { output += data.toString(); });
      proc.stderr.on('data', (data) => { output += data.toString(); });
      proc.on('close', (code) => {
        resolve({ code: code ?? 1, output });
      });
    });
    if (result.code !== 0) {
      console.error('Failed to download backup.', result.output);
      return NextResponse.json({ error: 'Failed to download backup.' }, { status: 500 });
    }
    // Read the file into a buffer
    const fileBuffer = await fsPromises.readFile(tempName);
    // Clean up temp file
    unlink(tempName, () => {});
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error('Failed to download backup.', err);
    return NextResponse.json({ error: 'Failed to download backup.' }, { status: 500 });
  }
} 