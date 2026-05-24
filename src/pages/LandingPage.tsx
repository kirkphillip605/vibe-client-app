import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { SearchIcon } from 'lucide-react';

export default function LandingPage() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const handleEnter = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) {
      navigate(`/event/${code.trim()}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/10 to-background p-4">
      <Card className="w-full max-w-md bg-white/30 backdrop-blur-lg border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SearchIcon className="h-5 w-5" />
            Enter Your Event Code
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleEnter} className="space-y-4">
            <Input
              placeholder="e.g., ABC123"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
            <Button type="submit" className="w-full">
              Continue
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
