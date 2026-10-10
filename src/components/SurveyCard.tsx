import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircleQuestion } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { nextQuestion, type SurveyQuestion } from '@/features/survey/questions';

/** One beta question at a time on Home; it disappears once answered. */
export function SurveyCard() {
  const { user } = useAuth();
  const [question, setQuestion] = useState<SurveyQuestion | null>(null);
  const [answered, setAnswered] = useState<string[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [thanks, setThanks] = useState(false);

  useEffect(() => {
    if (!user) return;
    let live = true;
    supabase.from('beta_survey_answers').select('question_key').eq('user_id', user.id)
      .then(({ data, error }) => {
        if (!live || error) return;
        const keys = (data ?? []).map((r: { question_key: string }) => r.question_key);
        setAnswered(keys);
        setQuestion(nextQuestion(keys));
      }, () => undefined);
    return () => { live = false; };
  }, [user]);

  if (!question && !thanks) return null;
  if (thanks) {
    return <div className="glass-card p-4 text-sm text-center" data-testid="survey-thanks">Thanks! That helps us shape the prizes.</div>;
  }
  if (!question) return null;

  const answer = async (value: string) => {
    setSaving(true);
    try {
      const { data } = await (supabase.rpc as unknown as (fn: string, a: Record<string, unknown>) => PromiseLike<{ data: { success?: boolean } | null }>)
        .call(supabase, 'answer_beta_survey', { p_key: question.key, p_answer: value });
      if (data?.success) {
        const keys = [...(answered ?? []), question.key];
        setAnswered(keys);
        const next = nextQuestion(keys);
        if (next) setQuestion(next); else { setQuestion(null); setThanks(true); setTimeout(() => setThanks(false), 3000); }
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-4 space-y-3" data-testid="survey-card">
      <p className="text-[10px] uppercase tracking-widest font-bold text-primary flex items-center gap-1.5"><MessageCircleQuestion className="w-4 h-4" /> Beta question</p>
      <p className="text-sm font-medium">{question.text}</p>
      <div className="flex gap-2">
        {question.options.map((o) => (
          <button key={o.value} disabled={saving} onClick={() => answer(o.value)} data-testid={`survey-${o.value}`}
            className="flex-1 px-3 py-2.5 rounded-xl border border-primary/40 bg-primary/10 text-sm font-bold hover:bg-primary/20 disabled:opacity-60 transition-colors">
            {o.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}
