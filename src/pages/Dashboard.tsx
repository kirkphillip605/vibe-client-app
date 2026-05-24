import { useEffect, useState } from 'react';
import api from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';

interface Event {
  id: string;
  uniqueCode: string;
  eventName: string;
  createdAt: string;
}

export default function Dashboard() {
  const { logout } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [form, setForm] = useState({
    eventName: '',
    contactName: '',
    phone: '',
    email: '',
  });
  const [error, setError] = useState<string | null>(null);

  const loadEvents = async () => {
    try {
      const resp = await api.get('/events');
      setEvents(resp.data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load events');
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const resp = await api.post('/events', form);
      setEvents([resp.data, ...events]);
      setForm({ eventName: '', contactName: '', phone: '', email: '' });
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Create failed');
    }
  };

  return (
    <div className="p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Events</h1>
        <button onClick={logout} className="text-sm text-gray-600 hover:underline">
          Logout
        </button>
      </header>

      {error && <p className="text-red-600 mb-4">{error}</p>}

      {/* Event creation form */}
      <section className="mb-8 rounded bg-gray-50 p-4 shadow">
        <h2 className="text-xl font-semibold mb-2">Create New Event</h2>
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <input
            placeholder="Event Name"
            required
            value={form.eventName}
            onChange={(e) => setForm({ ...form, eventName: e.target.value })}
            className="rounded border p-2"
          />
          <input
            placeholder="Contact Name"
            required
            value={form.contactName}
            onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            className="rounded border p-2"
          />
          <input
            placeholder="Phone"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded border p-2"
          />
          <input
            placeholder="Email"
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="rounded border p-2"
          />
          <button type="submit" className="col-span-2 rounded bg-indigo-600 py-2 text-white">
            Create Event
          </button>
        </form>
      </section>

      {/* List of events */}
      <section>
        <h2 className="text-xl font-semibold mb-2">Existing Events</h2>
        {events.length === 0 ? (
          <p>No events yet.</p>
        ) : (
          <ul className="space-y-2">
            {events.map((ev) => (
              <li key={ev.id} className="rounded bg-white p-3 shadow flex justify-between items-center">
                <div>
                  <p className="font-medium">{ev.eventName}</p>
                  <p className="text-sm text-gray-500">Code: {ev.uniqueCode}</p>
                </div>
                <Link
                  to={`/event/${ev.uniqueCode}`}
                  className="text-sm text-indigo-600 hover:underline"
                >
                  Open Client Portal
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
