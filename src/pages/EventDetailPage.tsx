import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Phone, Mail, User, Code, Music, ExternalLink, Library } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  artistName: string;
  albumName: string;
  artworkUrl: string;
  sourceService: string;
  externalTrackId: string;
}

interface Bucket {
  id: string;
  bucketType: 'ceremony' | 'reception' | 'do_not_play';
  notes: string;
  playlistUrl?: string;
  playlistName?: string;
  playlistProvider?: string;
  tracks: Track[];
}

interface Event {
  id: string;
  eventName: string;
  uniqueCode: string;
  contactName: string;
  phone: string;
  email: string;
  buckets: Bucket[];
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      try {
        const resp = await api.get(`/events/${id}`);
        setEvent(resp.data);
      } catch {
        // error handling
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="animate-spin h-8 w-8 text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg text-muted-foreground">Event not found</p>
        <Link to="/dashboard">
          <Button className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Back Link & Header */}
        <div className="flex items-center justify-between">
          <Link to="/dashboard">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Button>
          </Link>
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-full text-xs font-semibold">
            <Code className="h-3.5 w-3.5" />
            <span>Event Code: {event.uniqueCode}</span>
          </div>
        </div>

        {/* Event Detail Card */}
        <Card className="bg-white/30 backdrop-blur-lg border border-white/20 shadow-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-white/10 pb-6">
            <CardTitle className="text-3xl font-extrabold tracking-tight">{event.eventName}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6 md:grid-cols-3 pt-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contact Person</p>
                <p className="font-semibold text-sm">{event.contactName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Phone className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Phone Number</p>
                <p className="font-semibold text-sm">{event.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Email Address</p>
                <p className="font-semibold text-sm">{event.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Buckets Section */}
        <div className="space-y-6">
          <h2 className="text-xl font-bold tracking-tight">Event Playlists & Buckets</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {event.buckets.map((bucket) => (
              <Card key={bucket.id} className="bg-white/40 backdrop-blur-md border border-white/25 shadow-lg flex flex-col min-h-[400px]">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-lg font-bold capitalize flex items-center justify-between">
                    <span>{bucket.bucketType.replace('_', ' ')}</span>
                    <span className="text-xs font-normal text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full">
                      {bucket.tracks?.length || 0} tracks
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col p-4 space-y-4">
                  {/* Linked Playlist Badge */}
                  {bucket.playlistUrl ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <Music className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-xs font-medium text-emerald-800 truncate">
                          {bucket.playlistName || 'Linked Playlist'}
                        </span>
                      </div>
                      <a
                        href={bucket.playlistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center gap-0.5 flex-shrink-0"
                      >
                        Open <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  ) : (
                    <div className="bg-gray-100 border border-dashed rounded-lg p-3 text-center">
                      <p className="text-xs text-muted-foreground">No playlist linked</p>
                    </div>
                  )}

                  {/* Notes Container */}
                  <div className="bg-white/60 rounded-lg p-3 border border-gray-100">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Notes / Guidance</p>
                    <p className="text-xs text-foreground italic whitespace-pre-wrap">
                      {bucket.notes || 'No special instructions provided.'}
                    </p>
                  </div>

                  {/* Tracks Listing */}
                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px] pr-1">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Tracks</p>
                    {!bucket.tracks || bucket.tracks.length === 0 ? (
                      <div className="text-center py-6 border border-dashed rounded-lg bg-white/30">
                        <Library className="h-5 w-5 text-muted-foreground mx-auto mb-1.5 opacity-60" />
                        <p className="text-xs text-muted-foreground">No songs added yet</p>
                      </div>
                    ) : (
                      bucket.tracks.map((track) => (
                        <div key={track.id} className="flex items-center gap-2 p-2 bg-white/80 border rounded-lg shadow-sm hover:shadow transition-shadow">
                          {track.artworkUrl ? (
                            <img src={track.artworkUrl} alt={track.title} className="h-9 w-9 rounded object-cover flex-shrink-0" />
                          ) : (
                            <div className="h-9 w-9 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Music className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-xs truncate text-foreground">{track.title}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{track.artistName}</p>
                          </div>
                          <span className="text-[9px] bg-primary/10 text-primary font-bold px-1.5 py-0.5 rounded-full capitalize">
                            {track.sourceService}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
