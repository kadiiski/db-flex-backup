import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

function encryptLoginPayload(username: string, password: string) {
  const dbType = process.env.DB_TYPE?.toUpperCase();
  const dbPassword = process.env[`${dbType}_PASSWORD`];
  if (!dbPassword) {
    throw new Error(`Server misconfiguration: ${dbType}_PASSWORD not set`);
  }

  const key = crypto.createHash('sha256').update(dbPassword).digest();
  const iv = crypto.randomBytes(16);
  // Add expiration 1 hour from now
  const expiration = Date.now() + 60 * 60 * 1000;
  const data = JSON.stringify({ username, password, expiration });

  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(data, 'utf8', 'base64');
  encrypted += cipher.final('base64');

  return Buffer.concat([iv, Buffer.from(encrypted, 'base64')]).toString('base64');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Missing username or password' },
        { status: 400 }
      );
    }

    const dbType = process.env.DB_TYPE?.toUpperCase();
    const dbPassword = process.env[`${dbType}_PASSWORD`];
    if (!dbPassword) {
      return NextResponse.json(
        { error: 'Server misconfiguration' },
        { status: 500 }
      );
    }

    const token = encryptLoginPayload(username, password);
    const baseUrl = new URL(req.url).origin;
    const loginUrl = `${baseUrl}/api/login?token=${encodeURIComponent(token)}`;

    return NextResponse.json({
      token,
      loginUrl
    });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate token' },
      { status: 500 }
    );
  }
} 