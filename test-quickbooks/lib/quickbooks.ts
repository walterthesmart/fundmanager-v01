import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function getQBTokens(clerkUserId: string) {
  return prisma.userQuickBooksToken.findUnique({
    where: { clerkUserId },
  });
}

export async function saveQBTokens(
  clerkUserId: string,
  realmId: string,
  accessToken: string,
  refreshToken: string
) {
  return prisma.userQuickBooksToken.upsert({
    where: { clerkUserId },
    update: { realmId, accessToken, refreshToken, updatedAt: new Date() },
    create: { clerkUserId, realmId, accessToken, refreshToken },
  });
}

// Refresh the access token using the refresh token
export async function refreshAccessToken(clerkUserId: string) {
  const record = await getQBTokens(clerkUserId);
  if (!record) throw new Error('No tokens found');

  const credentials = Buffer.from(
    `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: record.refreshToken,
    }),
  });

  if (!res.ok) {
    // Refresh failed – user must reconnect
    await prisma.userQuickBooksToken.delete({ where: { clerkUserId } });
    throw new Error('Refresh token expired, please reconnect QuickBooks');
  }

  const tokens = await res.json();
  // Update DB with new tokens
  await prisma.userQuickBooksToken.update({
    where: { clerkUserId },
    data: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token, // may be same or new
      updatedAt: new Date(),
    },
  });

  return tokens.access_token;
}

// Fetch with automatic refresh on 401
export async function qbFetch(clerkUserId: string, url: string, options?: RequestInit) {
  let record = await getQBTokens(clerkUserId);
  if (!record) throw new Error('No QuickBooks connection');

  let accessToken = record.accessToken;

  const makeRequest = async (token: string) =>
    fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...options?.headers,
      },
    });

  let response = await makeRequest(accessToken);

  if (response.status === 401) {
    // Token expired – refresh
    accessToken = await refreshAccessToken(clerkUserId);
    response = await makeRequest(accessToken);
  }

  return response;
}