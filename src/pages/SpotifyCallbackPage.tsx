import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/api/client';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function SpotifyCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const exchangeAttempted = useRef(false);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      toast({ variant: 'destructive', title: 'Spotify auth failed', description: 'No authorization code returned from Spotify.' });
      navigate('/');
      return;
    }

    if (exchangeAttempted.current) return;
    exchangeAttempted.current = true;

    const exchangeToken = async () => {
      try {
        await api.post('/music/spotify/token', {
          code,
          redirectUri: `${window.location.origin}/spotify-callback`,
        });
        toast({ title: 'Spotify account connected!' });
        if (state) {
          navigate(`/event/${state}?import=spotify`);
        } else {
          navigate('/');
        }
      } catch {
        toast({ variant: 'destructive', title: 'Token exchange failed', description: 'Please check backend Spotify environment variables.' });
        navigate('/');
      }
    };

    exchangeToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex flex-col items-center justify-center space-y-4">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
      <p className="text-muted-foreground animate-pulse font-medium">Connecting your Spotify account...</p>
    </div>
  );
}
