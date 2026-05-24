import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PlusIcon, LinkIcon, CopyIcon } from 'lucide-react';
import api from '@/api/client';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

interface Event {
  id: string;
  uniqueCode: string;
  eventName: string;
  createdAt: string;
}

export default function DashboardPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const resp = await api.get('/events');
      setEvents(resp.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const copyLink = (code: string) => {
    const url = `${window.location.origin}/event/${code}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Link copied', description: url });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">My Events</h1>
          <Link to="/events/new">
            <Button>
              <PlusIcon className="mr-2 h-4 w-4" />
              New Event
            </Button>
          </Link>
        </div>

        {loading ? (
          <p>Loading…</p>
        ) : events.length === 0 ? (
          <p>No events yet. Create one!</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {events.map((ev) => (
              <Card
                key={ev.id}
                className="bg-white/30 backdrop-blur-lg border border-white/20"
              >
                <CardHeader className="pb-2">
                  <CardTitle>{ev.eventName}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Code: <span className="font-mono">{ev.uniqueCode}</span>
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyLink(ev.uniqueCode)}
                    >
                      <CopyIcon className="mr-1 h-3 w-3" />
                      Copy URL
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                    >
                      <a href={`/event/${ev.uniqueCode}`} target="_blank" rel="noopener">
                        <LinkIcon className="mr-1 h-3 w-3" />
                        Open Portal
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
