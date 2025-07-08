import { NextResponse } from 'next/server';
import { spawn } from 'child_process';

function humanFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let i = -1;
  do {
    bytes = bytes / 1024;
    i++;
  } while (bytes >= 1024 && i < units.length - 1);
  return bytes.toFixed(1) + ' ' + units[i];
}

function runBackupList(): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('backup', ['list'], { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });
    proc.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(output));
      }
    });
  });
}

export async function GET() {
  try {
    const output = await runBackupList();
    // Parse output for backup filenames with date and size
    const files = output
      .split('\n')
      .map(line => line.trim())
      .map(line => {
        // Match lines like: 2025-07-08 12:00:01    1205302 backup-2025-07-08_12-00-00.sql.gz
        const match = line.match(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(\d+)\s+(backup-\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.sql\.gz)$/);
        if (match) {
          const size = Number(match[2]);
          return {
            date: match[1],
            sizeHuman: humanFileSize(size),
            name: match[3],
          };
        }
        return null;
      })
      .filter(Boolean);
    return NextResponse.json({ files });
  } catch (err) {
    console.error('Backup list error:', err);
    return NextResponse.json({ files: [] });
  }
} 