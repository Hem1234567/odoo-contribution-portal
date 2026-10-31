const callbackUrl = () => `${process.env.BASE_URL.replace(/\/$/, '')}/auth/github/callback`;

export function createLoginUrl(state) {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', process.env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl());
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);
  return url.toString();
}

export async function exchangeCode(code) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code
    })
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || 'GitHub OAuth exchange failed.');
  return data.access_token;
}

export async function getGitHubUser(token) {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  });
  if (!response.ok) throw new Error('Unable to read the authenticated GitHub account.');
  return response.json();
}
