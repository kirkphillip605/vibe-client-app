/**
 * Small helper that returns an authenticated SDK instance for the
 * requested music service (Spotify, Tidal or Apple Music). The
 * authentication flow is delegated to BetterAuth on the back‑end,
 * but we need the client‑side SDKs for fetching playlists, track
 * details, etc.
 */

export async function getSpotifySdk() {
  const { SpotifyApi } = await import('@spotify/web-api-ts-sdk');
  return SpotifyApi;
}

export async function getTidalSdk() {
  const sdk = await import('@tidal-music/api');
  return sdk;
}

export async function getAppleMusicSdk() {
  // Apple Music Kit JS is loaded via a script tag at runtime.
  // This function returns the global MusicKit instance if available.
  if (typeof (window as any).MusicKit === 'undefined') {
    throw new Error('MusicKit not loaded');
  }
  return (window as any).MusicKit.getInstance();
}
