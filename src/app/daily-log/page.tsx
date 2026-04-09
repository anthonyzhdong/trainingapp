'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';

const SORENESS_LABELS = ['None', 'Mild', 'Moderate', 'High', 'Severe'];
const MOTIVATION_LABELS = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
const SLEEP_LABELS = ['Terrible', 'Poor', 'Fair', 'Good', 'Excellent'];
const SORENESS_EMOJIS = ['😌', '🙂', '😐', '😣', '🤕'];
const MOTIVATION_EMOJIS = ['😴', '😕', '😊', '💪', '🔥'];
const SLEEP_EMOJIS = ['😫', '😪', '😑', '🙂', '😴'];

export default function DailyLogPage() {
  const router = useRouter();
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [weight, setWeight] = useState('');
  const [sleep, setSleep] = useState<number | null>(null);
  const [soreness, setSoreness] = useState<number | null>(null);
  const [motivation, setMotivation] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadLog() {
      setLoading(true);
      setSuccess(false);
      setError(null);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('daily_logs')
        .select('weight, sleep, soreness, motivation')
        .eq('user_id', user.id)
        .eq('log_date', logDate)
        .maybeSingle();

      if (data) {
        setWeight(data.weight?.toString() ?? '');
        setSleep(data.sleep?.toString() ?? '');
        setSoreness(data.soreness ?? null);
        setMotivation(data.motivation ?? null);
      } else {
        setWeight('');
        setSleep(null);
        setSoreness(null);
        setMotivation(null);
      }

      setLoading(false);
    }

    loadLog();
  }, [logDate, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in.');
        return;
      }

      const { data: existing } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', user.id)
        .eq('log_date', logDate)
        .maybeSingle();

      const payload = {
        weight: weight ? parseFloat(weight) : null,
        sleep: sleep ?? null,
        soreness: soreness ?? null,
        motivation: motivation ?? null,
      };

      let dbError;
      if (existing) {
        const { error } = await supabase
          .from('daily_logs')
          .update(payload)
          .eq('id', existing.id);
        dbError = error;
      } else {
        const { error } = await supabase
          .from('daily_logs')
          .insert({ ...payload, user_id: user.id, log_date: logDate });
        dbError = error;
      }

      if (dbError) {
        setError(dbError.message);
      } else {
        setSuccess(true);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 p-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Daily Log</h1>
        <p className="text-sm text-gray-500 mb-8">Track how your body feels each day.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-7 max-w-md">

          {/* Date */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Date</label>
            <input
              type="date"
              value={logDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={e => setLogDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-fit"
            />
          </div>

          {loading ? (
            <p className="text-sm text-gray-400">Loading...</p>
          ) : (
            <>
              {/* Weight */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Weight (kg)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={weight}
                  onChange={e => setWeight(e.target.value)}
                  placeholder="e.g. 75.5"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 w-44"
                />
              </div>

              {/* Sleep */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Sleep quality</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSleep(sleep === v ? null : v)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        sleep === v
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{SLEEP_EMOJIS[v - 1]}</span>
                      <span className="text-xs">{v}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 min-h-[1rem]">
                  {sleep ? SLEEP_LABELS[sleep - 1] : 'Select a level'}
                </p>
              </div>

              {/* Soreness */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Soreness</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSoreness(soreness === v ? null : v)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        soreness === v
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{SORENESS_EMOJIS[v - 1]}</span>
                      <span className="text-xs">{v}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 min-h-[1rem]">
                  {soreness ? SORENESS_LABELS[soreness - 1] : 'Select a level'}
                </p>
              </div>

              {/* Motivation */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Motivation</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setMotivation(motivation === v ? null : v)}
                      className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        motivation === v
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{MOTIVATION_EMOJIS[v - 1]}</span>
                      <span className="text-xs">{v}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 min-h-[1rem]">
                  {motivation ? MOTIVATION_LABELS[motivation - 1] : 'Select a level'}
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}
              {success && <p className="text-sm text-green-600">Log saved.</p>}

              <button
                type="submit"
                disabled={saving}
                className="bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save log'}
              </button>
            </>
          )}
        </form>
      </main>
    </div>
  );
}
