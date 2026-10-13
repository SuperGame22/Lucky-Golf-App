/**
 * Share content — /earn/share
 * 3 photos + 1 short video the company may use. Admin approves; each approved set = 1 clover (= 1 raffle entry).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, Video, Loader2, X, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { CloverIcon } from '@/components/icons/CloverIcon';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TERMS_SECTIONS, TERMS_VERSION } from '@/features/content/terms';

const MAX_PHOTO = 15 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const MAX_VIDEO_SECONDS = 60;
const BUCKET = 'content-submissions';

type Rpc = (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc).call(supabase, fn, args);

interface Sub { id: string; status: 'pending' | 'approved' | 'rejected'; reject_reason: string | null; created_at: string }
type SubQuery = { select: (c: string) => { order: (c: string, o: { ascending: boolean }) => { limit: (n: number) => PromiseLike<{ data: Sub[] | null }> } } };

const extOf = (f: File) => {
  const m = /\.([a-zA-Z0-9]{2,5})$/.exec(f.name);
  return (m ? m[1] : f.type.split('/')[1] || 'bin').toLowerCase();
};
const isHeic = (f: File) => /\.(heic|heif)$/i.test(f.name);
const isPhoto = (f: File) => f.type.startsWith('image/') || isHeic(f);
const isVideoFile = (f: File) => f.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(f.name);
const contentTypeOf = (f: File) => {
  if (f.type) return f.type;
  const e = extOf(f);
  return ({ heic: 'image/heic', heif: 'image/heif', mov: 'video/quicktime', mp4: 'video/mp4', webm: 'video/webm' } as Record<string, string>)[e] ?? 'application/octet-stream';
};

const videoSeconds = (file: File) =>
  new Promise<number | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    v.preload = 'metadata';
    const done = (n: number | null) => { URL.revokeObjectURL(url); resolve(n); };
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) ? v.duration : null);
    v.onerror = () => done(null);
    v.src = url;
  });

export default function ShareContent() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<(File | null)[]>([null, null, null]);
  const [video, setVideo] = useState<File | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [busy, setBusy] = useState(false);
  const [subs, setSubs] = useState<Sub[]>([]);
  const photoRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const videoRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => photos.map((f) => (f && !isHeic(f) ? URL.createObjectURL(f) : null)), [photos]);
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  const loadSubs = async () => {
    const { data } = await (supabase.from as unknown as (t: string) => SubQuery)('content_submissions')
      .select('id, status, reject_reason, created_at').order('created_at', { ascending: false }).limit(10);
    setSubs(data ?? []);
  };
  useEffect(() => { loadSubs(); }, []);

  const pickPhoto = (i: number, f: File | undefined) => {
    if (!f) return;
    if (!isPhoto(f)) { toast.error('That file is not a photo'); return; }
    if (f.size > MAX_PHOTO) { toast.error('Photo is over 15 MB'); return; }
    setPhotos((p) => p.map((x, j) => (j === i ? f : x)));
  };
  const pickVideo = async (f: File | undefined) => {
    if (!f) return;
    if (!isVideoFile(f)) { toast.error('That file is not a video'); return; }
    if (f.size > MAX_VIDEO) { toast.error('Video is over 50 MB. Keep it short.'); return; }
    const secs = await videoSeconds(f);
    if (secs !== null && secs > MAX_VIDEO_SECONDS) { toast.error('Video must be 60 seconds or less'); return; }
    setVideo(f);
  };

  const ready = photos.every(Boolean) && !!video && agreed && !busy;

  const submit = async () => {
    if (!user || !ready || !video) return;
    setBusy(true);
    const batch = crypto.randomUUID();
    const uploaded: string[] = [];
    try {
      const photoPaths: string[] = [];
      for (let i = 0; i < 3; i++) {
        const f = photos[i] as File;
        const path = `${user.id}/${batch}/photo-${i + 1}.${extOf(f)}`;
        const { error } = await supabase.storage.from(BUCKET).upload(path, f, { contentType: contentTypeOf(f), upsert: false });
        if (error) throw new Error(error.message);
        uploaded.push(path); photoPaths.push(path);
      }
      const vPath = `${user.id}/${batch}/video.${extOf(video)}`;
      const { error: vErr } = await supabase.storage.from(BUCKET).upload(vPath, video, { contentType: contentTypeOf(video), upsert: false });
      if (vErr) throw new Error(vErr.message);
      uploaded.push(vPath);

      const { data, error } = await rpc('submit_content_submission', { p_photo_paths: photoPaths, p_video_path: vPath, p_terms_version: TERMS_VERSION });
      const res = data as { success?: boolean; error?: string } | null;
      if (error || !res?.success) throw new Error(error?.message ?? res?.error ?? 'Could not submit');
      toast.success('Sent! You earn a free Clover once we approve it.');
      setPhotos([null, null, null]); setVideo(null); setAgreed(false);
      loadSubs();
    } catch (e) {
      if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded).catch(() => undefined);
      toast.error(e instanceof Error ? e.message : 'Upload failed. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const slot = 'relative aspect-square rounded-xl border border-dashed border-border bg-black/30 flex flex-col items-center justify-center text-xs text-muted-foreground overflow-hidden';

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-wider">Share Your Clips</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Earn a free Clover</p>
          </div>
        </div>

        <div className="glass-card p-5 space-y-2" data-testid="share-explainer">
          <div className="flex items-center gap-2">
            <CloverIcon className="w-5 h-5 text-primary" />
            <p className="font-black">1 free Clover for every approved set</p>
          </div>
          <p className="text-sm text-muted-foreground">Send 3 pictures and a short video. Each approved set earns 1 free Clover, which is 1 entry in the weekly drawing.</p>
          <p className="text-sm text-muted-foreground">Photos up to 15 MB. Video up to 60 seconds and 50 MB. By sending, you let Lucky Golf use your content.</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">3 Photos</p>
          <div className="grid grid-cols-3 gap-3">
            {photos.map((f, i) => (
              <div key={i} className={slot}>
                <input ref={photoRefs[i]} type="file" accept="image/*,.heic,.heif" className="hidden"
                  onChange={(e) => { pickPhoto(i, e.target.files?.[0]); e.target.value = ''; }} />
                {f ? (
                  <>
                    {previews[i] ? <img src={previews[i] as string} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <span className="px-1 text-center break-all">{f.name}</span>}
                    <button type="button" aria-label="Remove photo" className="absolute top-1 right-1 bg-black/70 rounded-full p-1"
                      onClick={() => setPhotos((p) => p.map((x, j) => (j === i ? null : x)))}><X className="w-3 h-3" /></button>
                  </>
                ) : (
                  <button type="button" className="w-full h-full flex flex-col items-center justify-center gap-1" onClick={() => photoRefs[i].current?.click()}>
                    <Camera className="w-5 h-5 text-primary" /><span>Photo {i + 1}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">1 Short Video</p>
          <input ref={videoRef} type="file" accept="video/*,.mov,.mp4,.webm" className="hidden"
            onChange={(e) => { pickVideo(e.target.files?.[0]); e.target.value = ''; }} />
          {video ? (
            <div className="glass-card p-3 flex items-center justify-between text-sm">
              <span className="truncate pr-2">{video.name} ({(video.size / 1048576).toFixed(1)} MB)</span>
              <button type="button" aria-label="Remove video" onClick={() => setVideo(null)}><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <Button type="button" variant="outline" className="w-full" onClick={() => videoRef.current?.click()}>
              <Video className="w-4 h-4 mr-2" /> Choose video
            </Button>
          )}
        </div>

        <div className="glass-card p-4 space-y-3">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-1 h-4 w-4 accent-green-500" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} data-testid="terms-checkbox" />
            <span>I have read and agree to the <button type="button" className="underline text-primary" onClick={() => setShowTerms((s) => !s)}>Clovers Terms and Conditions</button>, and I allow Lucky Golf to use this content.</span>
          </label>
          {showTerms && (
            <div className="max-h-56 overflow-y-auto text-xs text-muted-foreground space-y-2 border-t border-border pt-3">
              {TERMS_SECTIONS.map((s) => (
                <div key={s.title}>
                  <p className="font-bold text-foreground">{s.title}</p>
                  {s.body.map((p, i) => <p key={i} className="mt-1">{p}</p>)}
                </div>
              ))}
            </div>
          )}
          <Button className="w-full" disabled={!ready} onClick={submit} data-testid="share-submit">
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading…</> : 'Submit for a free Clover'}
          </Button>
        </div>

        {subs.length > 0 && (
          <div>
            <p className="text-xs uppercase tracking-widest font-bold text-muted-foreground mb-2">Your Submissions</p>
            <div className="space-y-2">
              {subs.map((s) => (
                <div key={s.id} className="glass-card p-3 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</span>
                  {s.status === 'approved' && <span className="flex items-center gap-1 text-primary font-bold"><CheckCircle2 className="w-4 h-4" /> +1 Clover</span>}
                  {s.status === 'pending' && <span className="flex items-center gap-1 text-muted-foreground"><Clock className="w-4 h-4" /> In review</span>}
                  {s.status === 'rejected' && <span className="flex items-center gap-1 text-red-400"><XCircle className="w-4 h-4" /> Not approved{s.reject_reason ? `: ${s.reject_reason}` : ''}</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
