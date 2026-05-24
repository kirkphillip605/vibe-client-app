import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '@/api/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface Bucket {
  id: string;
  bucketType: string;
  notes: string;
}

interface Event {
  id: string;
  eventName: string;
  uniqueCode: string;
  buckets: Bucket[];
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvent = async () => {
      setLoading(true);
      const resp = await api.get(`/events/${id}`);
      setEvent(resp.data);
      setLoading(false);
    };
    fetchEvent();
  }, [id]);

  if (loading) return <Loader2 className="animate-spin mx-auto mt-10" />;
  if (!event) return <p className="text-center mt-10">Event not found</p>;

  return (
    <div className="p-8 min-h-screen bg-gradient-to-b from-background via-primary/5 to-background">
      <Card className="bg-white/30 backdrop-blur-lg border border-white/20">
        <CardHeader>
          <CardTitle>{event.eventName}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-2">Code: <span className="font-mono">{event.uniqueCode}</span></p>
          <h3 className="font-semibold mt-4 mb-2">Buckets</h3>
          <ul className="list-disc pl-5 space-y-2">
            {event.buckets.map((b) => (
              <li key={b.id}>
                <strong>{b.bucketType.replace('_', ' ')}</strong>: {b.notes || 'No notes'}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
