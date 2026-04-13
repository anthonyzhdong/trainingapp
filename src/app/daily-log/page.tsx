'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';

const STRESS_LABELS = ['None', 'Mild', 'Moderate', 'High', 'Severe'];
const SORENESS_LABELS = ['None', 'Mild', 'Moderate', 'High', 'Severe'];
const MOTIVATION_LABELS = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
const SLEEP_LABELS = ['Terrible', 'Poor', 'Fair', 'Good', 'Excellent'];
const STRESS_EMOJIS = ['😌', '🙂', '😐', '😣', '🤕'];
const SORENESS_EMOJIS = ['😌', '🙂', '😐', '😣', '🤕'];
const MOTIVATION_EMOJIS = ['😴', '😕', '😊', '💪', '🔥'];
const SLEEP_EMOJIS = ['😫', '😪', '😑', '🙂', '😴'];

// Readiness score: sleep 25%, inverted soreness 25%, inverted stress 25%, motivation 25%
// Grounded in Olympic S&C literature (Halson 2014, Kellmann et al. 2018)
function computeReadiness(sleep: number, soreness: number, stress: number, motivation: number): number {
  const raw = (sleep + (6 - soreness) + (6 - stress) + motivation) * 0.25;
  return Math.round(((raw - 1) / 4) * 100);
}

type ReadinessTier = { label: string; recommendation: string; color: string; bg: string; ring: string };

function getReadinessTier(score: number): ReadinessTier {
  if (score >= 85) return {
    label: 'Peak',
    recommendation: 'Full intensity. Competition-ready — push planned load.',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-400',
  };
  if (score >= 70) return {
    label: 'High',
    recommendation: 'Normal training load. Execute the session as programmed.',
    color: 'text-green-700',
    bg: 'bg-green-50',
    ring: 'ring-green-400',
  };
  if (score >= 55) return {
    label: 'Moderate',
    recommendation: 'Reduce volume 10–20%. Monitor during warm-up and adjust.',
    color: 'text-yellow-700',
    bg: 'bg-yellow-50',
    ring: 'ring-yellow-400',
  };
  if (score >= 40) return {
    label: 'Low',
    recommendation: 'Technique or aerobic session only. Drop intensity 30–40%.',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    ring: 'ring-orange-400',
  };
  return {
    label: 'Very Low',
    recommendation: 'Active recovery only. High injury risk — do not push load.',
    color: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-400',
  };
}

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
  const [stress, setStress] = useState<number | null>(null);
  const [savedReadiness, setSavedReadiness] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(true);

  useEffect(() => {
    async function loadLog() {
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data } = await supabase
        .from('daily_logs')
        .select('weight, sleep, soreness, stress, motivation')
        .eq('user_id', user.id)
        .eq('log_date', logDate)
        .maybeSingle();

      if (data) {
        setWeight(data.weight?.toString() ?? '');
        setSleep(data.sleep ?? null);
        setSoreness(data.soreness ?? null);
        setStress(data.stress ?? null);
        setMotivation(data.motivation ?? null);
        const s = data.sleep, so = data.soreness, st = data.stress, m = data.motivation;
        setSavedReadiness(s && so && st && m ? computeReadiness(s, so, st, m) : null);
        setIsEditing(false);
      } else {
        setWeight('');
        setSleep(null);
        setSoreness(null);
        setMotivation(null);
        setStress(null);
        setSavedReadiness(null);
        setIsEditing(true);
      }

      setLoading(false);
    }

    loadLog();
  }, [logDate, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
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
        stress: stress ?? null,
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
        if (sleep !== null && stress !== null && motivation !== null) {
          setSavedReadiness(computeReadiness(sleep, soreness ?? stress, stress, motivation));
        }
        setIsEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const datePicker = (
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
  );

  const readinessCard = savedReadiness !== null && (() => {
    const tier = getReadinessTier(savedReadiness);
    return (
      <div className={`flex items-center gap-5 rounded-2xl border px-5 py-4 ${tier.bg} ring-1 ${tier.ring}`}>
        <div className={`flex-shrink-0 w-16 h-16 rounded-full ring-4 ${tier.ring} flex flex-col items-center justify-center`}>
          <span className={`text-2xl font-bold leading-none ${tier.color}`}>{savedReadiness}</span>
          <span className={`text-[10px] font-medium uppercase tracking-wide ${tier.color} opacity-70`}>/ 100</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className={`text-sm font-semibold ${tier.color}`}>Readiness: {tier.label}</span>
          <span className="text-xs text-gray-600 leading-snug">{tier.recommendation}</span>
        </div>
      </div>
    );
  })();

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <main className="flex-1 bg-gray-50 p-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Daily Log</h1>
        <p className="text-sm text-gray-500 mb-8">Track how your body feels each day.</p>

        {loading ? (
          <div className="flex flex-col gap-7 max-w-md">
            {datePicker}
            <p className="text-sm text-gray-400">Loading...</p>
          </div>
        ) : !isEditing ? (
          /* ── Summary view ── */
          <div className="flex flex-col gap-5 max-w-md">
            {datePicker}
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
              {weight && (
                <div className="flex justify-between items-center px-5 py-3">
                  <span className="text-sm text-gray-500">Weight</span>
                  <span className="text-sm font-medium text-gray-900">{weight} kg</span>
                </div>
              )}
              {sleep !== null && (
                <div className="flex justify-between items-center px-5 py-3">
                  <span className="text-sm text-gray-500">Sleep</span>
                  <span className="text-sm font-medium text-gray-900">{SLEEP_EMOJIS[sleep - 1]} {SLEEP_LABELS[sleep - 1]} <span className="text-gray-400 font-normal">{sleep}/5</span></span>
                </div>
              )}
              {soreness !== null && (
                <div className="flex justify-between items-center px-5 py-3">
                  <span className="text-sm text-gray-500">Soreness</span>
                  <span className="text-sm font-medium text-gray-900">{SORENESS_EMOJIS[soreness - 1]} {SORENESS_LABELS[soreness - 1]} <span className="text-gray-400 font-normal">{soreness}/5</span></span>
                </div>
              )}
              {stress !== null && (
                <div className="flex justify-between items-center px-5 py-3">
                  <span className="text-sm text-gray-500">Stress</span>
                  <span className="text-sm font-medium text-gray-900">{STRESS_EMOJIS[stress - 1]} {STRESS_LABELS[stress - 1]} <span className="text-gray-400 font-normal">{stress}/5</span></span>
                </div>
              )}
              {motivation !== null && (
                <div className="flex justify-between items-center px-5 py-3">
                  <span className="text-sm text-gray-500">Motivation</span>
                  <span className="text-sm font-medium text-gray-900">{MOTIVATION_EMOJIS[motivation - 1]} {MOTIVATION_LABELS[motivation - 1]} <span className="text-gray-400 font-normal">{motivation}/5</span></span>
                </div>
              )}
            </div>
            {readinessCard}
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="border border-gray-300 text-gray-700 rounded-lg py-2 text-sm font-medium hover:bg-gray-100 transition-colors w-full"
            >
              Edit log
            </button>
          </div>
        ) : (
          /* ── Edit form ── */
          <form onSubmit={handleSubmit} className="flex flex-col gap-7 max-w-md">
            {datePicker}

            {/* Weight */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Weight (kg)</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={weight}
                onChange={e => setWeight(e.target.value)}
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

            {/* Stress */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-700">Stress</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setStress(stress === v ? null : v)}
                    className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                      stress === v
                        ? 'bg-gray-900 border-gray-900 text-white'
                        : 'border-gray-200 text-gray-600 bg-white hover:border-gray-400 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-xl">{STRESS_EMOJIS[v - 1]}</span>
                    <span className="text-xs">{v}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 min-h-[1rem]">
                {stress ? STRESS_LABELS[stress - 1] : 'Select a level'}
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

            <button
              type="submit"
              disabled={saving}
              className="bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save log'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
