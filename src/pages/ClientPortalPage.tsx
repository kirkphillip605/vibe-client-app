import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import api from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusIcon, Trash2, ArrowLeft, Music } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface Bucket {
  id: string;
  bucketType: 'ceremony' | 'reception' | 'do_not_play';
  notes: string;
  playlistUrl?: string;
  playlistName?: string;
  playlistProvider?: string;
}

interface Track {
  id: string;
  title: string;
  artistName: string;
  albumName: string;
  artworkUrl: string;
  sourceService: string;
  externalTrackId: string;
}

interface Event {
  id: string;
  eventName: string;
  uniqueCode: string;
  buckets: Bucket[];
}

export default function ClientPortalPage() {
  const { code } = useParams<{ code: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [playlistModalOpen, setPlaylistModalOpen] = useState(false);
  const [activeService, setActiveService] = useState<'Spotify' | 'Tidal' | null>(null);
  const [playlists, setPlaylists] = useState<any[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<any | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<any[]>([]);
  const [tracksLoading, setTracksLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  // Listen for the redirect 'import' query param to auto-open modal
  useEffect(() => {
    if (!event) return;
    const importService = searchParams.get('import');
    if (importService === 'spotify' || importService === 'tidal') {
      const service = importService === 'spotify' ? 'Spotify' : 'Tidal';
      
      // Clear parameter from URL so it doesn't reopen on manual page refresh
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('import');
      setSearchParams(newParams, { replace: true });

      // Automatically trigger import click
      handlePlaylistImportClick(service);
    }
  }, [searchParams, setSearchParams, event]);

  // Fetch event + buckets
  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      try {
        const resp = await api.get(`/events/code/${code}`);
        const { event: eventData, clientToken } = resp.data;
        // Save the client JWT to localStorage
        localStorage.setItem('client_token', clientToken);
        setEvent(eventData);
        // default bucket
        setSelectedBucket(eventData.buckets[0]);
      } catch {
        toast({ variant: 'destructive', title: 'Invalid code', description: 'Please check your code and try again.' });
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [code]);

  // Load tracks for selected bucket
  useEffect(() => {
    if (!selectedBucket) return;
    const load = async () => {
      try {
        const resp = await api.get(`/music/bucket/${selectedBucket.id}/tracks`);
        setTracks(resp.data);
      } catch {
        toast({ variant: 'destructive', title: 'Failed to load tracks' });
      }
    };
    load();
  }, [selectedBucket]);

  // Update notes
  const saveNotes = async (notes: string) => {
    if (!selectedBucket) return;
    try {
      await api.patch('/music/bucket/notes', {
        bucketId: selectedBucket.id,
        notes,
      });
      toast({ title: 'Notes saved' });
      // update locally
      setEvent((prev) =>
        prev && {
          ...prev,
          buckets: prev.buckets.map((b) =>
            b.id === selectedBucket.id ? { ...b, notes } : b
          ),
        }
      );
    } catch {
      toast({ variant: 'destructive', title: 'Failed to save notes' });
    }
  };

  // Spotify search proxy through backend
  const performSearch = async () => {
    if (!search.trim()) return;
    setSearchLoading(true);
    try {
      const resp = await api.get(`/music/search?q=${encodeURIComponent(search)}`);
      setSearchResults(resp.data);
    } catch {
      toast({ variant: 'destructive', title: 'Search failed' });
    } finally {
      setSearchLoading(false);
    }
  };

  const addTrack = async (track: Track) => {
    if (!selectedBucket) return;
    try {
      const resp = await api.post('/music/track', {
        bucketId: selectedBucket.id,
        title: track.title,
        artistName: track.artistName,
        albumName: track.albumName,
        artworkUrl: track.artworkUrl,
        sourceService: 'Spotify',
        externalTrackId: track.externalTrackId,
      });
      toast({ title: 'Track added' });
      setTracks((prev) => [...prev, resp.data]);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to add track' });
    }
  };

  const removeTrack = async (trackId: string) => {
    try {
      await api.delete(`/music/track/${trackId}`);
      setTracks((prev) => prev.filter((t) => t.id !== trackId));
      toast({ title: 'Track removed' });
    } catch {
      toast({ variant: 'destructive', title: 'Failed to remove track' });
    }
  };

  const handlePlaylistImportClick = async (service: 'Spotify' | 'Tidal') => {
    const tokenKey = service === 'Spotify' ? 'spotify_access_token' : 'tidal_access_token';
    const token = localStorage.getItem(tokenKey);

    if (!token) {
      const backendUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      window.location.href = `${backendUrl}/music/${service.toLowerCase()}/authorize?state=${code}`;
      return;
    }

    setActiveService(service);
    setSelectedPlaylist(null);
    setPlaylistTracks([]);
    setPlaylistModalOpen(true);
    setPlaylistsLoading(true);

    try {
      const headers: Record<string, string> = {};
      if (service === 'Spotify') {
        headers['x-spotify-access-token'] = token;
      } else {
        headers['x-tidal-access-token'] = token;
      }
      const resp = await api.get(`/music/${service.toLowerCase()}/playlists`, {
        headers,
      });
      setPlaylists(resp.data);
    } catch {
      localStorage.removeItem(tokenKey);
      const backendUrl = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
      window.location.href = `${backendUrl}/music/${service.toLowerCase()}/authorize?state=${code}`;
    } finally {
      setPlaylistsLoading(false);
    }
  };

  const fetchPlaylistTracks = async (playlist: any) => {
    const tokenKey = activeService === 'Spotify' ? 'spotify_access_token' : 'tidal_access_token';
    const token = localStorage.getItem(tokenKey);
    if (!token) return;

    setSelectedPlaylist(playlist);
    setTracksLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (activeService === 'Spotify') {
        headers['x-spotify-access-token'] = token;
      } else {
        headers['x-tidal-access-token'] = token;
      }
      const resp = await api.get(`/music/${activeService?.toLowerCase()}/playlist/${playlist.id}/tracks`, {
        headers,
      });
      setPlaylistTracks(resp.data);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to fetch tracks' });
    } finally {
      setTracksLoading(false);
    }
  };

  const importPlaylistTracks = async () => {
    if (!selectedBucket || playlistTracks.length === 0) return;
    setImporting(true);
    let successCount = 0;

    for (const track of playlistTracks) {
      try {
        const resp = await api.post('/music/track', {
          bucketId: selectedBucket.id,
          title: track.title,
          artistName: track.artistName,
          albumName: track.albumName,
          artworkUrl: track.artworkUrl,
          sourceService: activeService || 'Spotify',
          externalTrackId: track.externalTrackId,
        });
        successCount++;
        setTracks((prev) => [...prev, resp.data]);
      } catch {
        // Continue importing remaining
      }
    }

    toast({
      title: 'Import complete!',
      description: `Successfully added ${successCount} tracks to your ${selectedBucket.bucketType.replace('_', ' ')} list.`,
    });
    setImporting(false);
    setPlaylistModalOpen(false);
  };

  const handleLinkPlaylist = async (playlist: any) => {
    if (!selectedBucket) return;
    try {
      await api.patch('/music/bucket/playlist', {
        bucketId: selectedBucket.id,
        playlistUrl: playlist.externalUrl,
        playlistName: playlist.name,
        playlistProvider: activeService,
      });
      toast({ title: 'Playlist linked successfully!' });
      
      // update event state locally
      setEvent((prev) =>
        prev && {
          ...prev,
          buckets: prev.buckets.map((b) =>
            b.id === selectedBucket.id
              ? {
                  ...b,
                  playlistUrl: playlist.externalUrl,
                  playlistName: playlist.name,
                  playlistProvider: activeService,
                }
              : b
          ),
        }
      );
      // update selected bucket locally
      setSelectedBucket((prev) =>
        prev && prev.id === selectedBucket.id
          ? {
              ...prev,
              playlistUrl: playlist.externalUrl,
              playlistName: playlist.name,
              playlistProvider: activeService,
            }
          : prev
      );
      setPlaylistModalOpen(false);
    } catch {
      toast({ variant: 'destructive', title: 'Failed to link playlist' });
    }
  };

  const handleUnlinkPlaylist = async () => {
    if (!selectedBucket) return;
    try {
      await api.patch('/music/bucket/playlist', {
        bucketId: selectedBucket.id,
        playlistUrl: null,
        playlistName: null,
        playlistProvider: null,
      });
      toast({ title: 'Playlist unlinked successfully.' });

      // update event state locally
      setEvent((prev) =>
        prev && {
          ...prev,
          buckets: prev.buckets.map((b) =>
            b.id === selectedBucket.id
              ? {
                  ...b,
                  playlistUrl: undefined,
                  playlistName: undefined,
                  playlistProvider: undefined,
                }
              : b
          ),
        }
      );
      // update selected bucket locally
      setSelectedBucket((prev) =>
        prev && prev.id === selectedBucket.id
          ? {
              ...prev,
              playlistUrl: undefined,
              playlistName: undefined,
              playlistProvider: undefined,
            }
          : prev
      );
    } catch {
      toast({ variant: 'destructive', title: 'Failed to unlink playlist' });
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  if (!event) return <p className="text-center mt-10 text-lg text-muted-foreground">Event not found</p>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-extrabold text-center tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-600">
          {event.eventName} Client Portal
        </h1>

        {/* Bucket selector */}
        <div className="flex flex-wrap justify-center gap-3">
          {event.buckets.map((b) => (
            <Button
              key={b.id}
              variant={selectedBucket?.id === b.id ? 'default' : 'outline'}
              className="capitalize"
              onClick={() => setSelectedBucket(b)}
            >
              {b.bucketType.replace('_', ' ')}
            </Button>
          ))}
        </div>

        {/* Notes area */}
        {selectedBucket && (
          <Card className="bg-white/30 backdrop-blur-lg border border-white/20 shadow-xl">
            <CardHeader>
              <CardTitle className="flex items-center text-lg capitalize">
                {selectedBucket.bucketType.replace('_', ' ')} – Notes & Guidance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                defaultValue={selectedBucket.notes}
                placeholder="Add any special instructions or guidance for the DJ in this bucket..."
                className="min-h-[120px] bg-white/50 backdrop-blur-sm border-gray-200 focus:border-primary"
                onBlur={(e) => saveNotes(e.target.value)}
              />
            </CardContent>
          </Card>
        )}

        {/* Linked Playlist card */}
        {selectedBucket && selectedBucket.playlistUrl && (
          <Card className="bg-emerald-500/10 border border-emerald-500/20 shadow-xl">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                  <Music className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-semibold text-sm">
                    Linked {selectedBucket.playlistProvider} Playlist
                  </h4>
                  <a
                    href={selectedBucket.playlistUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 mt-0.5"
                  >
                    {selectedBucket.playlistName || 'View Playlist'}
                  </a>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                onClick={handleUnlinkPlaylist}
              >
                Unlink Playlist
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Track list */}
        {selectedBucket && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold capitalize">
                {selectedBucket.bucketType.replace('_', ' ')} Playlist
              </h2>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { setSearch(''); setSearchResults([]); setSearchModalOpen(true); }} className="shadow-md">
                  <PlusIcon className="mr-1 h-4 w-4" />
                  Search Tracks
                </Button>
                <Button variant="outline" onClick={() => handlePlaylistImportClick('Spotify')} className="shadow-sm border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950">
                  Import Spotify Playlist
                </Button>
                <Button variant="outline" onClick={() => handlePlaylistImportClick('Tidal')} className="shadow-sm border-cyan-500/30 text-cyan-600 hover:bg-cyan-50 hover:text-cyan-700 dark:text-cyan-400 dark:hover:bg-cyan-950">
                  Import Tidal Playlist
                </Button>
              </div>
            </div>

            {/* Existing tracks */}
            {tracks.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground bg-white/10 rounded-lg border border-dashed border-gray-300">
                No tracks added to this list yet. Click "Add from Spotify" to search and add tracks.
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {tracks.map((t) => (
                  <Card
                    key={t.id}
                    className="bg-white/30 backdrop-blur-lg border border-white/20 flex overflow-hidden shadow hover:shadow-md transition-shadow"
                  >
                    {t.artworkUrl && (
                      <img
                        src={t.artworkUrl}
                        alt={t.title}
                        className="h-24 w-24 object-cover flex-shrink-0"
                      />
                    )}
                    <div className="p-3 flex flex-col justify-between flex-1 min-w-0">
                      <div>
                        <p className="font-semibold text-sm md:text-base truncate">{t.title}</p>
                        <p className="text-xs md:text-sm text-muted-foreground truncate">
                          {t.artistName}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate italic">
                          {t.albumName}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="mt-2 self-start h-7 px-2 text-xs"
                        onClick={() => removeTrack(t.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Spotify search modal */}
        {searchModalOpen && selectedBucket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-xl">Search Spotify</CardTitle>
                <p className="text-xs text-muted-foreground">Adding to <span className="font-bold capitalize">{selectedBucket.bucketType.replace('_', ' ')}</span></p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 overflow-y-auto flex-1">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    performSearch();
                  }}
                >
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search for track title, artist..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="bg-white"
                      autoFocus
                    />
                    <Button type="submit" disabled={searchLoading}>
                      {searchLoading && <Loader2 className="animate-spin mr-1 h-4 w-4" />}
                      Search
                    </Button>
                  </div>
                </form>

                <div className="space-y-2 mt-2">
                  {searchResults.map((tr) => (
                    <Card key={tr.id} className="flex items-center gap-3 p-2 bg-white/50 border hover:bg-white/80 transition-colors">
                      {tr.artworkUrl && (
                        <img src={tr.artworkUrl} alt={tr.title} className="h-12 w-12 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{tr.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{tr.artistName}</p>
                      </div>
                      <Button size="sm" onClick={() => addTrack(tr)} className="h-8 px-3">
                        <PlusIcon className="mr-1 h-3.5 w-3.5" />
                        Add
                      </Button>
                    </Card>
                  ))}
                  
                  {searchResults.length === 0 && !searchLoading && search.trim() !== '' && (
                    <p className="text-center py-4 text-sm text-muted-foreground">No tracks found.</p>
                  )}
                </div>
              </CardContent>
              <div className="flex justify-end p-4 border-t bg-gray-50 gap-2">
                <Button variant="outline" onClick={() => setSearchModalOpen(false)}>
                  Close
                </Button>
              </div>
            </Card>
          </div>
        )}

        {/* Playlist import modal */}
        {playlistModalOpen && selectedBucket && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-lg bg-white/95 backdrop-blur-md shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
              <CardHeader className="pb-3 border-b">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Music className="h-5 w-5 text-primary" />
                  Import {activeService} Playlist
                </CardTitle>
                <p className="text-xs text-muted-foreground">Importing to <span className="font-bold capitalize">{selectedBucket.bucketType.replace('_', ' ')}</span></p>
              </CardHeader>
              <CardContent className="space-y-4 p-4 overflow-y-auto flex-1">
                {playlistsLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-2">
                    <Loader2 className="animate-spin h-8 w-8 text-primary" />
                    <p className="text-sm text-muted-foreground">Loading your playlists...</p>
                  </div>
                ) : !selectedPlaylist ? (
                  <div className="space-y-2">
                    {playlists.length === 0 ? (
                      <p className="text-center py-8 text-muted-foreground">No playlists found on your account.</p>
                    ) : (
                      playlists.map((pl) => (
                        <Card key={pl.id} className="flex items-center gap-3 p-3 bg-white/50 border hover:bg-white/80 transition-colors">
                          {pl.artworkUrl ? (
                            <img src={pl.artworkUrl} alt={pl.name} className="h-12 w-12 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-12 w-12 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Music className="h-6 w-6 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{pl.name}</p>
                            <p className="text-xs text-muted-foreground">{pl.trackCount} tracks</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleLinkPlaylist(pl)}>
                              Link Playlist
                            </Button>
                            <Button size="sm" onClick={() => fetchPlaylistTracks(pl)}>
                              View & Import
                            </Button>
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Button variant="ghost" size="sm" onClick={() => setSelectedPlaylist(null)} className="h-8 px-2">
                        <ArrowLeft className="mr-1 h-4 w-4" />
                        Back to Playlists
                      </Button>
                      <span className="text-sm font-semibold truncate flex-1 text-right text-muted-foreground">
                        {selectedPlaylist.name}
                      </span>
                    </div>

                    {tracksLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-2">
                        <Loader2 className="animate-spin h-8 w-8 text-primary" />
                        <p className="text-sm text-muted-foreground">Fetching tracks...</p>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                        {playlistTracks.map((tr, index) => (
                          <div key={index} className="flex items-center gap-3 p-2 border-b text-xs">
                            {tr.artworkUrl && (
                              <img src={tr.artworkUrl} alt={tr.title} className="h-8 w-8 rounded object-cover flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold truncate">{tr.title}</p>
                              <p className="text-muted-foreground truncate">{tr.artistName}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <div className="flex justify-end p-4 border-t bg-gray-50 gap-2">
                <Button variant="outline" onClick={() => setPlaylistModalOpen(false)} disabled={importing}>
                  Close
                </Button>
                {selectedPlaylist && !tracksLoading && (
                  <Button onClick={importPlaylistTracks} disabled={importing || playlistTracks.length === 0}>
                    {importing ? (
                      <>
                        <Loader2 className="animate-spin mr-1 h-4 w-4" />
                        Importing...
                      </>
                    ) : (
                      `Import All ${playlistTracks.length} Tracks`
                    )}
                  </Button>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
