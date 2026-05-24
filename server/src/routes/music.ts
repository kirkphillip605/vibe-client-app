import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, AuthRequest, prisma } from '../middleware/auth.js';

export const musicRouter = Router();

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
