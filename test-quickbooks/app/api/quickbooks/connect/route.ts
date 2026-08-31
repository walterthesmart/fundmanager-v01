import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const { userId } = auth();
  if (!userId) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const params = new URLSearchParams({
    client_id: process.env.QB_CLIENT_ID!,
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: process.env.QB_REDIRECT_URI!,
    response_type: 'code',
    state: userId, // optional: pass Clerk userId to verify in callback
  });

  const url = `https://appcenter.intuit.com/connect/oauth2?${params.toString()}`;
  return NextResponse.redirect(url);
}