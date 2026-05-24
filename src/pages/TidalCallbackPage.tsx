import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '@/api/client';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

export default function TidalCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');

    if (!code) {
      toast({ variant: 'destructive', title: 'Tidal auth failed', description: 'No authorization code returned from Tidal.' });
      navigate('/');
      return;
    }

    const exchangeToken = async () => {
      try {
        const resp = await api.post('/music/tidal/token', {
          code,
          redirectUri: `${window.location.origin}/tidal-callback`,
        });
        localStorage.setItem('tidal_access_token', resp.data.access_token);
        toast({ title: 'Tidal account connected!' });
        if (state) {
          navigate(`/event/${state}`);
        } else {
          navigate('/');
        }
      } catch {
        toast({ variant: 'destructive', title: 'Token exchange failed', description: 'Please check backend Tidal environment variables.' });
        navigate('/');
      }
    };

    exchangeToken();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex flex-col items-center justify-center space-y-4">
      <Loader2 className="animate-spin h-10 w-10 text-primary" />
      <p className="text-muted-foreground animate-pulse font-medium">Connecting your Tidal account...</p>
    </div>
  );
}
