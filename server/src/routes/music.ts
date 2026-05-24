import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest, prisma } from '../middleware/auth.js';
import { SpotifyApi } from '@spotify/web-api-ts-sdk';

export const musicRouter = Router();

// Helper to get Spotify token and refresh if expired
async function getSpotifyTokenForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event || !event.spotifyAccessToken) {
    return null;
  }

  if (event.spotifyTokenExpiry && new Date() > new Date(event.spotifyTokenExpiry)) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return event.spotifyAccessToken;
    }

    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: event.spotifyRefreshToken || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Spotify token refresh failed');
      }

      const data = await response.json();
      const updatedAccessToken = data.access_token;
      const updatedRefreshToken = data.refresh_token || event.spotifyRefreshToken;
      const updatedExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

      await prisma.event.update({
        where: { id: eventId },
        data: {
          spotifyAccessToken: updatedAccessToken,
          spotifyRefreshToken: updatedRefreshToken,
          spotifyTokenExpiry: updatedExpiry,
        },
      });

      return updatedAccessToken;
    } catch (err) {
      console.error('Failed to refresh Spotify token:', err);
      return null;
    }
  }

  return event.spotifyAccessToken;
}

// Helper to get Tidal token and refresh if expired
async function getTidalTokenForEvent(eventId: string) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event || !event.tidalAccessToken) {
    return null;
  }

  if (event.tidalTokenExpiry && new Date() > new Date(event.tidalTokenExpiry)) {
    const clientId = process.env.TIDAL_CLIENT_ID;
    const clientSecret = process.env.TIDAL_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return event.tidalAccessToken;
    }

    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const response = await fetch('https://auth.tidal.com/v1/oauth2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: event.tidalRefreshToken || '',
        }),
      });

      if (!response.ok) {
        throw new Error('Tidal token refresh failed');
      }

      const data = await response.json();
      const updatedAccessToken = data.access_token;
      const updatedRefreshToken = data.refresh_token || event.tidalRefreshToken;
      const updatedExpiry = new Date(Date.now() + (data.expires_in - 60) * 1000);

      await prisma.event.update({
        where: { id: eventId },
        data: {
          tidalAccessToken: updatedAccessToken,
          tidalRefreshToken: updatedRefreshToken,
          tidalTokenExpiry: updatedExpiry,
        },
      });

      return updatedAccessToken;
    } catch (err) {
      console.error('Failed to refresh Tidal token:', err);
      return null;
    }
  }

  return event.tidalAccessToken;
}

async function getSpotifyToken(req: AuthRequest) {
  const eventId = req.clientEvent?.id || (req.query.eventId as string);
  if (!eventId) return null;
  return getSpotifyTokenForEvent(eventId);
}

async function getTidalToken(req: AuthRequest) {
  const eventId = req.clientEvent?.id || (req.query.eventId as string);
  if (!eventId) return null;
  return getTidalTokenForEvent(eventId);
}

// 1. Get tracks for a public bucket (no auth needed)
musicRouter.get('/bucket/:id/tracks', async (req, res) => {
  const { id } = req.params;
  try {
    const tracks = await prisma.track.findMany({
      where: { bucketId: id },
      orderBy: { position: 'asc' },
    });
    res.json(tracks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 6. Spotify Authorize Redirect (No JWT auth needed for browser redirects)
musicRouter.get('/spotify/authorize', (req, res) => {
  const state = req.query.state as string || '';
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const redirectUri = `${frontendUrl}/spotify-callback`;

  if (!clientId) {
    return res.redirect(`${redirectUri}?code=mock-code&state=${state}`);
  }

  res.redirect(`https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=playlist-read-private%20playlist-read-collaborative&state=${state}`);
});

// 7. Tidal Authorize Redirect (No JWT auth needed for browser redirects)
musicRouter.get('/tidal/authorize', (req, res) => {
  const state = req.query.state as string || '';
  const clientId = process.env.TIDAL_CLIENT_ID;
  const frontendUrl = process.env.CORS_ORIGIN || 'http://localhost:5173';
  const redirectUri = `${frontendUrl}/tidal-callback`;

  if (!clientId) {
    return res.redirect(`${redirectUri}?code=mock-code&state=${state}`);
  }

  res.redirect(`https://login.tidal.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=playlists.read&state=${state}`);
});

// Require Auth (DJ or Client) for subsequent actions
musicRouter.use(requireAuth);

// 2. Spotify Search Proxy
let spotifyAccessToken = '';
let spotifyTokenExpiry = 0;

async function getSpotifyAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null; // Fallback to mock search if env variables are not present
  }

  if (spotifyAccessToken && Date.now() < spotifyTokenExpiry) {
    return spotifyAccessToken;
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) return null;

    const data: any = await response.json();
    spotifyAccessToken = data.access_token;
    spotifyTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
    return spotifyAccessToken;
  } catch {
    return null;
  }
}

musicRouter.get('/search', async (req: AuthRequest, res) => {
  const query = req.query.q as string;
  if (!query) return res.status(400).json({ error: 'Query parameter "q" is required' });

  try {
    let tracks: any[] = [];
    const token = await getSpotifyAccessToken();

    if (!token) {
      // Fallback to mock tracks for demonstration/dev build
      tracks = [
        {
          id: 'mock-1',
          title: 'Starlight',
          artistName: 'Muse',
          albumName: 'Black Holes and Revelations',
          artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150',
          sourceService: 'Spotify',
          externalTrackId: 'mock-1',
        },
        {
          id: 'mock-2',
          title: 'Get Lucky',
          artistName: 'Daft Punk ft. Pharrell Williams',
          albumName: 'Random Access Memories',
          artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150',
          sourceService: 'Spotify',
          externalTrackId: 'mock-2',
        },
        {
          id: 'mock-3',
          title: 'Shape of You',
          artistName: 'Ed Sheeran',
          albumName: '÷ (Divide)',
          artworkUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=150',
          sourceService: 'Spotify',
          externalTrackId: 'mock-3',
        },
        {
          id: 'mock-4',
          title: 'Uptown Funk',
          artistName: 'Mark Ronson ft. Bruno Mars',
          albumName: 'Uptown Special',
          artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150',
          sourceService: 'Spotify',
          externalTrackId: 'mock-4',
        },
      ].filter(
        (t) =>
          t.title.toLowerCase().includes(query.toLowerCase()) ||
          t.artistName.toLowerCase().includes(query.toLowerCase())
      );
    } else {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!response.ok) throw new Error('Spotify API search failed');
      const data: any = await response.json();
      tracks = data.tracks.items.map((t: any) => ({
        id: t.id,
        title: t.name,
        artistName: t.artists.map((a: any) => a.name).join(', '),
        albumName: t.album.name,
        artworkUrl: t.album.images[0]?.url ?? '',
        sourceService: 'Spotify',
        externalTrackId: t.id,
      }));
    }

    res.json(tracks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Add a track to a bucket
const trackSchema = z.object({
  bucketId: z.string(),
  title: z.string(),
  artistName: z.string(),
  albumName: z.string(),
  artworkUrl: z.string().url().optional().or(z.literal('')),
  sourceService: z.enum(['Spotify', 'Apple', 'Tidal']),
  externalTrackId: z.string(),
});

musicRouter.post('/track', async (req: AuthRequest, res) => {
  const parse = trackSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error);
  const data = parse.data;

  try {
    const bucket = await prisma.musicBucket.findUnique({
      where: { id: data.bucketId },
      include: { event: true },
    });
    if (!bucket) return res.status(404).json({ error: 'Bucket not found' });

    // Auth validation (DJ owns event OR client token matches event)
    const isDJOwner = req.user?.role === 'dj' && bucket.event.userId === req.user.id;
    const isAuthorizedClient = req.clientEvent?.role === 'client' && bucket.eventId === req.clientEvent.id;

    if (!isDJOwner && !isAuthorizedClient) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const track = await prisma.track.create({
      data: {
        ...data,
        artworkUrl: data.artworkUrl || '',
        position: (await prisma.track.count({ where: { bucketId: data.bucketId } })) + 1,
      },
    });

    res.status(201).json(track);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Update bucket notes
const notesSchema = z.object({
  bucketId: z.string(),
  notes: z.string(),
});

musicRouter.patch('/bucket/notes', async (req: AuthRequest, res) => {
  const parse = notesSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error);
  const { bucketId, notes } = parse.data;

  try {
    const bucket = await prisma.musicBucket.findUnique({
      where: { id: bucketId },
      include: { event: true },
    });
    if (!bucket) return res.status(404).json({ error: 'Bucket not found' });

    // Auth validation (DJ owns event OR client token matches event)
    const isDJOwner = req.user?.role === 'dj' && bucket.event.userId === req.user.id;
    const isAuthorizedClient = req.clientEvent?.role === 'client' && bucket.eventId === req.clientEvent.id;

    if (!isDJOwner && !isAuthorizedClient) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const updated = await prisma.musicBucket.update({
      where: { id: bucketId },
      data: { notes },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Delete a track from a bucket
musicRouter.delete('/track/:id', async (req: AuthRequest, res) => {
  const { id } = req.params;

  try {
    const track = await prisma.track.findUnique({
      where: { id },
      include: { bucket: { include: { event: true } } },
    });
    if (!track) return res.status(404).json({ error: 'Track not found' });

    // Auth validation (DJ owns event OR client token matches event)
    const isDJOwner = req.user?.role === 'dj' && track.bucket.event.userId === req.user.id;
    const isAuthorizedClient =
      req.clientEvent?.role === 'client' && track.bucket.eventId === req.clientEvent.id;

    if (!isDJOwner && !isAuthorizedClient) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    await prisma.track.delete({ where: { id } });
    res.json({ message: 'Track removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



// 8. Spotify User Authentication Code Exchange
musicRouter.post('/spotify/token', async (req: AuthRequest, res) => {
  const { code, redirectUri } = req.body;
  const eventId = req.clientEvent?.id || req.body.eventId;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing event identification' });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        spotifyAccessToken: 'mock-spotify-access-token',
        spotifyRefreshToken: 'mock-spotify-refresh-token',
        spotifyTokenExpiry: new Date(Date.now() + 3600 * 1000),
      },
    });
    return res.json({ access_token: 'mock-spotify-access-token' });
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Spotify token exchange failed', details: errText });
    }

    const data = await response.json();
    
    await prisma.event.update({
      where: { id: eventId },
      data: {
        spotifyAccessToken: data.access_token,
        spotifyRefreshToken: data.refresh_token,
        spotifyTokenExpiry: new Date(Date.now() + (data.expires_in - 60) * 1000),
      },
    });

    res.json({ message: 'Spotify connection updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Get User Spotify Playlists
musicRouter.get('/spotify/playlists', async (req: AuthRequest, res) => {
  try {
    const accessToken = await getSpotifyToken(req);

    if (!accessToken || accessToken === 'mock-spotify-access-token') {
      return res.json([
        { id: 'mock-pl-1', name: 'My Chill Vibes', trackCount: 15, artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150', externalUrl: 'https://open.spotify.com' },
        { id: 'mock-pl-2', name: 'Wedding Party Jams', trackCount: 32, artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150', externalUrl: 'https://open.spotify.com' }
      ]);
    }

    const sdk = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID || '', {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: '',
    });

    const data = await sdk.currentUser.playlists.playlists(50);
    const playlists = data.items.map((pl) => ({
      id: pl.id,
      name: pl.name,
      trackCount: pl.tracks?.total ?? 0,
      artworkUrl: pl.images?.[0]?.url ?? '',
      externalUrl: pl.external_urls?.spotify ?? `https://open.spotify.com/playlist/${pl.id}`,
    }));

    res.json(playlists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Get Spotify Playlist Tracks
musicRouter.get('/spotify/playlist/:id/tracks', async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const accessToken = await getSpotifyToken(req);

    if (!accessToken || accessToken === 'mock-spotify-access-token') {
      if (id === 'mock-pl-1') {
        return res.json([
          { id: 'mock-t-1', title: 'Midnight City', artistName: 'M83', albumName: 'Hurry Up, We\'re Dreaming', artworkUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=150', externalTrackId: 'mock-t-1' },
          { id: 'mock-t-2', title: 'Intro', artistName: 'The xx', albumName: 'xx', artworkUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=150', externalTrackId: 'mock-t-2' }
        ]);
      } else {
        return res.json([
          { id: 'mock-t-3', title: 'September', artistName: 'Earth, Wind & Fire', albumName: 'The Best of Earth, Wind & Fire, Vol. 1', artworkUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=150', externalTrackId: 'mock-t-3' },
          { id: 'mock-t-4', title: 'Dancing Queen', artistName: 'ABBA', albumName: 'Arrival', artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150', externalTrackId: 'mock-t-4' }
        ]);
      }
    }

    const sdk = SpotifyApi.withAccessToken(process.env.SPOTIFY_CLIENT_ID || '', {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 3600,
      refresh_token: '',
    });

    const data = await sdk.playlists.getPlaylistItems(id, undefined, undefined, 50);
    const tracks = data.items
      .filter((item) => item.track && 'artists' in item.track)
      .map((item: any) => {
        const track = item.track;
        return {
          id: track.id,
          title: track.name,
          artistName: track.artists.map((a: any) => a.name).join(', '),
          albumName: track.album.name,
          artworkUrl: track.album.images?.[0]?.url ?? '',
          externalTrackId: track.id,
        };
      });

    res.json(tracks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Tidal User Authentication Code Exchange
musicRouter.post('/tidal/token', async (req: AuthRequest, res) => {
  const { code, redirectUri } = req.body;
  const eventId = req.clientEvent?.id || req.body.eventId;

  if (!eventId) {
    return res.status(400).json({ error: 'Missing event identification' });
  }

  const clientId = process.env.TIDAL_CLIENT_ID;
  const clientSecret = process.env.TIDAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    await prisma.event.update({
      where: { id: eventId },
      data: {
        tidalAccessToken: 'mock-tidal-access-token',
        tidalRefreshToken: 'mock-tidal-refresh-token',
        tidalTokenExpiry: new Date(Date.now() + 3600 * 1000),
      },
    });
    return res.json({ access_token: 'mock-tidal-access-token' });
  }

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://auth.tidal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params,
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Tidal token exchange failed', details: errText });
    }

    const data = await response.json();
    
    await prisma.event.update({
      where: { id: eventId },
      data: {
        tidalAccessToken: data.access_token,
        tidalRefreshToken: data.refresh_token,
        tidalTokenExpiry: new Date(Date.now() + (data.expires_in - 60) * 1000),
      },
    });

    res.json({ message: 'Tidal connection updated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 10. Get User Tidal Playlists
musicRouter.get('/tidal/playlists', async (req: AuthRequest, res) => {
  try {
    const accessToken = await getTidalToken(req);

    if (!accessToken || accessToken === 'mock-tidal-access-token') {
      return res.json([
        { id: 'mock-td-1', name: 'Tidal Chill Wave', trackCount: 8, artworkUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=150', externalUrl: 'https://tidal.com' },
        { id: 'mock-td-2', name: 'My High Fidelity Jams', trackCount: 20, artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150', externalUrl: 'https://tidal.com' }
      ]);
    }

    const response = await fetch('https://api.tidal.com/v1/me/playlists', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch Tidal playlists' });
    const data: any = await response.json();
    const playlists = data.items.map((pl: any) => ({
      id: pl.uuid,
      name: pl.title,
      trackCount: pl.numberOfTracks,
      artworkUrl: pl.image ?? '',
      externalUrl: pl.url ?? `https://tidal.com/playlist/${pl.uuid}`,
    }));
    res.json(playlists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 11. Get Tidal Playlist Tracks
musicRouter.get('/tidal/playlist/:id/tracks', async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const accessToken = await getTidalToken(req);

    if (!accessToken || accessToken === 'mock-tidal-access-token') {
      if (id === 'mock-td-1') {
        return res.json([
          { id: 'mock-tdt-1', title: 'Royals', artistName: 'Lorde', albumName: 'Pure Heroine', artworkUrl: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=150', externalTrackId: 'mock-tdt-1' }
        ]);
      } else {
        return res.json([
          { id: 'mock-tdt-2', title: 'Superstition', artistName: 'Stevie Wonder', albumName: 'Talking Book', artworkUrl: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=150', externalTrackId: 'mock-tdt-2' }
        ]);
      }
    }

    const response = await fetch(`https://api.tidal.com/v1/playlists/${id}/tracks`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) return res.status(response.status).json({ error: 'Failed to fetch Tidal playlist tracks' });
    const data: any = await response.json();
    const tracks = data.items.map((item: any) => ({
      id: item.id,
      title: item.title,
      artistName: item.artists.map((a: any) => a.name).join(', '),
      albumName: item.album.title,
      artworkUrl: item.album.cover ?? '',
      externalTrackId: item.id,
    }));
    res.json(tracks);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 12. Link/Unlink a playlist to/from a bucket
const playlistLinkSchema = z.object({
  bucketId: z.string(),
  playlistUrl: z.string().url().nullable().or(z.literal('')),
  playlistName: z.string().nullable().or(z.literal('')),
  playlistProvider: z.enum(['Spotify', 'Tidal']).nullable().or(z.literal('')),
});

musicRouter.patch('/bucket/playlist', async (req: AuthRequest, res) => {
  const parse = playlistLinkSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json(parse.error);
  const { bucketId, playlistUrl, playlistName, playlistProvider } = parse.data;

  try {
    const bucket = await prisma.musicBucket.findUnique({
      where: { id: bucketId },
      include: { event: true },
    });
    if (!bucket) return res.status(404).json({ error: 'Bucket not found' });

    // Auth validation
    const isDJOwner = req.user?.role === 'dj' && bucket.event.userId === req.user.id;
    const isAuthorizedClient = req.clientEvent?.role === 'client' && bucket.eventId === req.clientEvent.id;

    if (!isDJOwner && !isAuthorizedClient) {
      return res.status(403).json({ error: 'Forbidden: Access denied' });
    }

    const updated = await prisma.musicBucket.update({
      where: { id: bucketId },
      data: {
        playlistUrl: playlistUrl || null,
        playlistName: playlistName || null,
        playlistProvider: playlistProvider || null,
      },
    });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
