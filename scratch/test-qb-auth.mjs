async function testAuth() {
  const clientId = process.env.QB_CLIENT_ID;
  const clientSecret = process.env.QB_CLIENT_SECRET;
  const refreshToken = process.env.QB_REFRESH_TOKEN;
  const realmId = process.env.QB_REALM_ID;
  
  console.log("clientId length:", clientId?.length);
  
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const tokenResponse = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${auth}`
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });

  const tokenData = await tokenResponse.json();
  console.log("Status:", tokenResponse.status);
  console.log("Response:", tokenData);
}

testAuth();
