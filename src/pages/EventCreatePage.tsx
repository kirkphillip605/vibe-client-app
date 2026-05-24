import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import api from '@/api/client';
import { toast } from '@/hooks/use-toast';

export default function EventCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    eventName: '',
    contactName: '',
    phone: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await api.post('/events', form);
      toast({
        title: 'Event created',
        description: `Code: ${resp.data.uniqueCode}`,
      });
      navigate('/dashboard');
    } catch (err) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not create event' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-primary/5 to-background flex items-center justify-center p-4">
      <Card className="w-full max-w-xl bg-white/30 backdrop-blur-lg border border-white/20">
        <CardHeader>
          <CardTitle>Create New Event</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              placeholder="Event Name"
              required
              value={form.eventName}
              onChange={(e) => setForm({ ...form, eventName: e.target.value })}
            />
            <Input
              placeholder="Contact Name"
              required
              value={form.contactName}
              onChange={(e) => setForm({ ...form, contactName: e.target.value })}
            />
            <Input
              placeholder="Phone Number"
              required
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <Input
              placeholder="Contact Email"
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Create Event
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
