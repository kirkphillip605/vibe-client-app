import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, PlusIcon, Trash2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';

interface Bucket {
  id: string;
  bucketType: 'ceremony' | 'reception' | 'do_not_play';
  notes: string;
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
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchModalOpen, setSearchModalOpen] = useState(false);

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

        {/* Track list */}
        {selectedBucket && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold capitalize">
                {selectedBucket.bucketType.replace('_', ' ')} Playlist
              </h2>
              <Button onClick={() => { setSearch(''); setSearchResults([]); setSearchModalOpen(true); }} className="shadow-md">
                <PlusIcon className="mr-1 h-4 w-4" />
                Add from Spotify
              </Button>
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
      </div>
    </div>
  );
}
