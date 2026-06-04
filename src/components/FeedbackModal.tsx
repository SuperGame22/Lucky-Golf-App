import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FeedbackModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  if (!open) return null;

  const submit = async () => {
    if (!text.trim()) return;
    setSending(true);
    // Simple feedback log — just console for now, can wire to a DB table later
    console.log('Feedback submitted:', text);
    toast.success('Thanks for the feedback!');
    setText('');
    setSending(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg">Send Feedback</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-muted"><X className="w-5 h-5" /></button>
        </div>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Tell us what you think..."
          rows={4}
          className="w-full bg-muted/50 border border-border rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button className="flex-1" onClick={submit} disabled={!text.trim() || sending}>
            {sending ? 'Sending...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  );
}
