import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import { SignJWT } from 'jose';
import crypto from 'crypto';

// Global store for failed login attempts
const failedAttempts = { count: 0, lastFailed: 0 };

// Helper for global throttling
function checkThrottle() {
  if (failedAttempts.count >= 3) {
    // Exponential backoff: 1, 2, 4, 8... minutes
    const waitMinutes = Math.pow(2, failedAttempts.count - 3); // 1 for 4th, 2 for 5th, etc.
    const now = Date.now();
    const waitMs = waitMinutes * 60 * 1000;
    const elapsed = now - failedAttempts.lastFailed;
    if (elapsed < waitMs) {
      const remaining = Math.ceil((waitMs - elapsed) / 1000);
      return NextResponse.json({ error: `Too many failed attempts. Try again in ${remaining} seconds.` }, { status: 429 });
    }
  }
  return null;
}

// Helper to authenticate and set cookie
async function authenticateAndRespond(username: string, password: string) {
  // Extract DB config from env dynamically
  const dbType = process.env.DB_TYPE?.toUpperCase();
  if (!dbType) {
    return NextResponse.json({ error: 'DB_TYPE not set' }, { status: 400 });
  }
  const keys = ['HOST', 'PORT', 'DATABASE', 'USER', 'PASSWORD'];
  const dbConfig: Record<string, string | undefined> = {};
  for (const key of keys) {
    dbConfig[key.toLowerCase()] = process.env[`${dbType}_${key}`];
  }
  if (Object.values(dbConfig).some(v => !v)) {
    return NextResponse.json({ error: 'Missing database configuration in environment variables' }, { status: 400 });
  }
  // Call the backup script with check_login
  const checkLoginArgs = [
    'check-login',
    '--user', username,
    '--password', password,
  ];
  const result: { success: boolean, output: string } = await new Promise((resolve) => {
    const proc = spawn('backup', checkLoginArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    proc.stdout.on('data', (data) => { output += data.toString(); });
    proc.stderr.on('data', (data) => { output += data.toString(); });
    proc.on('close', (code) => {
      resolve({ success: code === 0, output });
    });
  });
  if (!result.success) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }
  // On success, create JWT and set cookie
  const secret = new TextEncoder().encode(process.env.SERVICE_USER_ADMIN!);
  const exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour
  const jwt = await new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(exp)
    .sign(secret);
  const response = NextResponse.json({ message: 'Login successful' });
  response.cookies.set('auth', jwt, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 60 * 60,
    path: '/',
  });
  return response;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;
    if (!username || !password) {
      return NextResponse.json({ error: 'Missing username or password' }, { status: 400 });
    }

    // Global throttling logic
    const throttleResponse = checkThrottle();
    if (throttleResponse) return throttleResponse;

    const response = await authenticateAndRespond(username, password);
    if (response.status === 401) {
      // Update global failed attempts
      failedAttempts.count += 1;
      failedAttempts.lastFailed = Date.now();
    } else {
      // On success, clear global failed attempts
      failedAttempts.count = 0;
      failedAttempts.lastFailed = 0;
    }
    return response;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 400 });
    }
    const dbType = process.env.DB_TYPE?.toUpperCase();
    const password = process.env[`${dbType}_PASSWORD`];
    if (!password) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    // Global throttling logic
    const throttleResponse = checkThrottle();
    if (throttleResponse) return throttleResponse;

    // Decrypt token
    let username, providedPassword;
    try {
      const key = crypto.createHash('sha256').update(password).digest();
      const raw = Buffer.from(token, 'base64');
      const iv = raw.subarray(0, 16);
      const encrypted = raw.subarray(16);
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      const payload = JSON.parse(decrypted);
      
      // Check if token has expired
      if (payload.expiration && payload.expiration < Date.now()) {
        failedAttempts.count += 1;
        failedAttempts.lastFailed = Date.now();
        return NextResponse.json({ error: 'Token has expired' }, { status: 401 });
      }
      
      username = payload.username;
      providedPassword = payload.password;
    } catch {
      failedAttempts.count += 1;
      failedAttempts.lastFailed = Date.now();
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const response = await authenticateAndRespond(username, providedPassword);
    if (response.status === 401) {
      // Update global failed attempts
      failedAttempts.count += 1;
      failedAttempts.lastFailed = Date.now();
      return response;
    } else {
      // On success, clear global failed attempts
      failedAttempts.count = 0;
      failedAttempts.lastFailed = 0;
      // Redirect to /
      const redirectRes = NextResponse.redirect(new URL('/', req.url));
      // Copy the auth cookie from the response
      const authCookie = response.cookies.get('auth');
      if (authCookie) {
        redirectRes.cookies.set('auth', authCookie.value, authCookie);
      }
      return redirectRes;
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
} 