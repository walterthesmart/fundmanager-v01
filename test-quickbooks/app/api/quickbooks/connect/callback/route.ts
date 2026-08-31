import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { saveQBTokens } from '@/lib/quickbooks';

export async function GET(req: Request) {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const realmId = searchParams.get('realmId');
  const state = searchParams.get('state'); // we passed userId as state

  if (!code || !realmId) {
    return new NextResponse('Missing code or realmId', { status: 400 });
  }

  // Optional: verify state === userId for extra security
  if (state !== userId) {
    return new NextResponse('Invalid state', { status: 400 });
  }

  // Exchange code for tokens
  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64');

  const tokenRes = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.QB_REDIRECT_URI!,
    }),
  });

  if (!tokenRes.ok) {
    console.error(await tokenRes.text());
    return new NextResponse('Token exchange failed', { status: 500 });
  }

  const tokens = await tokenRes.json();
  await saveQBTokens(
    userId,
    realmId,
    tokens.access_token,
    tokens.refresh_token
  );

  // Redirect to dashboard or any page
  return NextResponse.redirect(new URL('/dashboard', req.url));
}