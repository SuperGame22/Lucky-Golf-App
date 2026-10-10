/**
 * Add a missing course: the player uploads a photo of the scorecard, admin enters the pars and approves it.
 * The player earns a clover when it is approved.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { photoPath, requestProblem } from '@/features/courses/requests';

interface MyRequest { id: string; course_name: string; city: string | null; state: string; status: 'pending' | 'approved' | 'rejected'; reject_reason: string | null }

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

/** Shrinks big phone photos before upload so it works on slow connections. */
async function shrink(file: File): Promise<File> {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    return blob && blob.size < file.size ? new File([blob], 'scorecard.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

export default function AddCourse() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [name, setName] = useState(params.get('name') ?? '');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [mine, setMine] = useState<MyRequest[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase.from('course_requests').select('id, course_name, city, state, status, reject_reason').order('created_at', { ascending: false }).limit(10);
    setMine((data ?? []) as unknown as MyRequest[]);
  };
  useEffect(() => { loadMine(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setPhoto(f);
    setPreview(URL.createObjectURL(f));
    setError(null);
  };

  const submit = async () => {
    if (!user) return;
    const problem = requestProblem({ name, city, state }, photo);
    if (problem || !photo) { setError(problem); return; }
    setBusy(true);
    setError(null);
    try {
      const file = await shrink(photo);
      const path = photoPath(user.id, crypto.randomUUID(), file.type);
      const up = await supabase.storage.from('course-scorecards').upload(path, file, { contentType: file.type, upsert: false });
      if (up.error) throw new Error('Could not upload the photo. Try again.');
      const { data, error: err } = await (supabase.rpc as unknown as Rpc).call(supabase, 'submit_course_request', {
        p_name: name, p_city: city, p_state: state, p_notes: null, p_photo_path: path,
      });
      const res = data as { success?: boolean; error?: string } | null;
      if (err || !res?.success) throw new Error(res?.error ?? err?.message ?? 'Could not send. Try again.');
      setSent(true);
      setName(''); setCity(''); setState(''); setPhoto(null); setPreview(null);
      loadMine();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider">Add your course</h1>
            <p className="text-xs text-muted-foreground">Don't see it? Send us the scorecard.</p>
          </div>
        </div>

        {sent && (
          <div className="glass-card p-4 flex items-start gap-3 border-primary/40" data-testid="course-sent">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <p className="text-sm"><b>Thanks!</b> We'll review it soon. You earn a clover when it's approved.</p>
          </div>
        )}

        <div className="glass-card p-5 space-y-3">
          <Input placeholder="Course name" value={name} onChange={(e) => setName(e.target.value)} data-testid="course-name" />
          <div className="flex gap-2">
            <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
            <Input placeholder="State" className="w-28" value={state} onChange={(e) => setState(e.target.value)} data-testid="course-state" />
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid="course-photo" />
          {preview ? (
            <button className="block w-full" onClick={() => fileRef.current?.click()}>
              <img src={preview} alt="Scorecard preview" className="w-full max-h-64 object-contain rounded-xl bg-black/40" />
              <span className="text-xs text-primary font-bold">Tap to change the photo</span>
            </button>
          ) : (
            <Button variant="outline" className="w-full h-24 flex-col gap-2 border-dashed" onClick={() => fileRef.current?.click()}>
              <Camera className="w-6 h-6" /> Take or choose a photo of the scorecard
            </Button>
          )}
          <p className="text-[11px] text-muted-foreground">Make sure the pars for every hole are readable. Yardages help too.</p>
          {error && <p className="text-xs text-red-400" data-testid="course-error">{error}</p>}
          <Button className="w-full font-black uppercase tracking-wider" disabled={busy} onClick={submit} data-testid="course-submit">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Send for review'}
          </Button>
        </div>

        {mine.length > 0 && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Your requests</p>
            {mine.map((r) => (
              <div key={r.id} className="glass-card p-3 flex items-center gap-3 text-sm">
                {r.status === 'approved' ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  : r.status === 'rejected' ? <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  : <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
                <div className="min-w-0">
                  <p className="font-bold truncate">{r.course_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.status === 'approved' ? 'Added. +1 clover!' : r.status === 'rejected' ? (r.reject_reason || 'Not added') : 'Waiting for review'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
