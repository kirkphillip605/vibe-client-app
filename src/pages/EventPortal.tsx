import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '@/api/client';

interface Event {
  id: string;
  eventName: string;
  contactName: string;
  phone: string;
  email: string;
  buckets: { id: string; bucketType: string }[];
}

export default function EventPortal() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadEvent = async () => {
    try {
      const resp = await api.get(`/events/code/${code}`);
      setEvent(resp.data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Event not found');
    }
  };

  useEffect(() => {
    loadEvent();
  }, [code]);

  if (error) return <p className="p-4 text-red-600">{error}</p>;
  if (!event) return <p className="p-4">Loading…</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{event.eventName}</h1>
      <p className="mb-2">Contact: {event.contactName}</p>
      <p className="mb-4">Phone: {event.phone}</p>

      <h2 className="text-xl font-semibold mb-2">Playlists</h2>
      <ul className="space-y-2">
        {event.buckets.map((bucket) => (
          <li key={bucket.id}>
            <button
              onClick={() => navigate(`/event/${code}/bucket/${bucket.id}`)}
              className="text-indigo-600 hover:underline"
            >
              {bucket.bucketType.replace('_', ' ')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
