import { useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api from '@/api/client';

interface Track {
  id: string;
  title: string;
  artistName: string;
  albumName: string;
  artworkUrl: string;
  sourceService: string;
  externalTrackId: string;
  position: number;
}

export default function BucketView() {
  const { code, bucketId } = useParams<{ code: string; bucketId: string }>();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadTracks = async () => {
    try {
      const resp = await api.get(`/music/bucket/${bucketId}/tracks`);
      setTracks(resp.data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to load tracks');
    }
  };

  const loadNotes = async () => {
    try {
      const resp = await api.get(`/music/bucket/${bucketId}`);
      setNotes(resp.data.notes ?? '');
    } catch (e) {
      // ignore – notes may be empty initially
    }
  };

  useEffect(() => {
    loadTracks();
    loadNotes();
  }, [bucketId]);

  const handleNotesSave = async () => {
    try {
      await api.patch('/music/bucket/notes', { bucketId, notes });
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'Failed to save notes');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Playlist</h2>
      {error && <p className="text-red-600">{error}</p>}

      {/* Notes */}
      <section className="mb-6">
        <h3 className="font-semibold">Bucket Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded border p-2"
          rows={3}
        />
        <button onClick={handleNotesSave} className="mt-2 rounded bg-indigo-600 py-1 px-3 text-white">
          Save Notes
        </button>
      </section>

      {/* Track list */}
      <ul className="space-y-3">
        {tracks.map((track) => (
          <li key={track.id} className="flex items-center space-x-4 rounded bg-gray-50 p-2 shadow">
            {track.artworkUrl && (
              <img src={track.artworkUrl} alt={track.title} className="h-12 w-12 object-cover rounded" />
            )}
            <div>
              <p className="font-medium">{track.title}</p>
              <p className="text-sm text-gray-600">
                {track.artistName} – {track.albumName}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
