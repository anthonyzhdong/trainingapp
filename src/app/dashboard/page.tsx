'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import {
  calculateBMR,
  calculateTDEE,
  calculateWorkoutKcal,
  calculateRunningKcal,
  calculateCyclingKcal,
} from '@/lib/calories';

// ── Types ──────────────────────────────────────────────────────────────────────

type SessionType = 'lifting' | 'running' | 'cycling';

interface Workout {
  id: string;
  name: string;
  created_at: string;
  duration: number;
  rpe: number | null;
  session_type: SessionType;
}

interface RunningSession {
  workout_id: string;
  distance: number;
  run_type: string;
  elevation_gain: number | null;
}

interface CyclingSession {
  workout_id: string;
  distance: number;
  ride_type: string;
  elevation_gain: number | null;
  avg_power: number | null;
}

interface RunningSessionFull {
  distance: number;
  run_type: string;
  elevation_gain: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  notes: string | null;
}

interface CyclingSessionFull {
  distance: number;
  ride_type: string;
  elevation_gain: number | null;
  avg_power: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_cadence: number | null;
  notes: string | null;
}

interface ExerciseEntry {
  name: string;
  sets: { reps: number; weight: number }[];
}

interface DailyLog {
  log_date: string;
  weight: number | null;
  sleep: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const RUN_TYPES = ['easy', 'tempo', 'interval', 'long', 'race'] as const;
const CYCLE_TYPES = ['easy', 'endurance', 'tempo', 'interval', 'climb', 'race'] as const;
const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

const CATEGORY_COLORS: Record<SessionType, string> = {
  lifting: 'bg-blue-100 text-blue-700 border-blue-200',
  running: 'bg-green-100 text-green-700 border-green-200',
  cycling: 'bg-orange-100 text-orange-700 border-orange-200',
};

const CATEGORY_DOT: Record<SessionType, string> = {
  lifting: 'bg-blue-500',
  running: 'bg-green-500',
  cycling: 'bg-orange-500',
};

const CATEGORY_LABELS: Record<SessionType, string> = {
  lifting: 'Lifting',
  running: 'Running',
  cycling: 'Cycling',
};

const SLEEP_LABELS = ['Terrible', 'Poor', 'Fair', 'Good', 'Excellent'];

// ── Design tokens ──────────────────────────────────────────────────────────────

const inputCls =
  'w-full bg-[#FAF7F2] border border-[#EDE5DB] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1612] placeholder-[#CCC1B5] focus:outline-none focus:border-[#C4622A] focus:bg-white transition-colors';
const sectionLabelCls = 'text-[10px] font-semibold uppercase tracking-widest text-[#9B8575]';
const fieldLabelCls = 'text-xs font-semibold text-[#9B8575] tracking-wide';
const cardCls = 'bg-white border border-[#EDE5DB] rounded-2xl p-5 flex flex-col gap-4';

// ── Helpers ────────────────────────────────────────────────────────────────────

function getWeekMonday(offset = 0): Date {
  const now = new Date();
  const dow = now.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const d = new Date(now);
  d.setDate(now.getDate() + toMonday + offset * 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function toDateKey(d: Date): string {
  return d.toDateString();
}

function toLogDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function computePace(distanceKm: number, durationMin: number): string | null {
  if (!distanceKm || !durationMin) return null;
  const paceMin = durationMin / distanceKm;
  const mins = Math.floor(paceMin);
  const secs = Math.round((paceMin - mins) * 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs} /km`;
}

function computeSpeed(distanceKm: number, durationMin: number): string | null {
  if (!distanceKm || !durationMin) return null;
  return `${(distanceKm / (durationMin / 60)).toFixed(1)} km/h`;
}

function workoutSubtitle(
  w: Workout,
  runningSessions: Record<string, RunningSession>,
  cyclingSessions: Record<string, CyclingSession>,
): string {
  if (w.session_type === 'running') {
    const rs = runningSessions[w.id];
    if (rs) return `${rs.distance % 1 === 0 ? rs.distance : rs.distance.toFixed(1)} km · ${rs.run_type}`;
  }
  if (w.session_type === 'cycling') {
    const cs = cyclingSessions[w.id];
    if (cs) return `${cs.distance % 1 === 0 ? cs.distance : cs.distance.toFixed(1)} km · ${cs.ride_type}`;
  }
  return w.duration ? formatDuration(w.duration) : '';
}

function calcDayKcal(
  dayWorkouts: Workout[],
  runningSessions: Record<string, RunningSession>,
  cyclingSessions: Record<string, CyclingSession>,
  profileWeight: number | null,
): number {
  let total = 0;
  for (const w of dayWorkouts) {
    if (w.session_type === 'running') {
      const rs = runningSessions[w.id];
      if (rs && profileWeight) {
        total += calculateRunningKcal(rs.distance, profileWeight, rs.elevation_gain ?? 0);
      } else {
        total += calculateWorkoutKcal([{ duration: w.duration, rpe: w.rpe }]);
      }
    } else if (w.session_type === 'cycling') {
      const cs = cyclingSessions[w.id];
      if (cs && profileWeight) {
        total += calculateCyclingKcal(cs.distance, profileWeight, cs.elevation_gain ?? 0, cs.avg_power, w.duration);
      } else {
        total += calculateWorkoutKcal([{ duration: w.duration, rpe: w.rpe }]);
      }
    } else {
      total += calculateWorkoutKcal([{ duration: w.duration, rpe: w.rpe }]);
    }
  }
  return total;
}

function computeReadiness(sleep: number, soreness: number, stress: number, motivation: number): number {
  const raw = ((sleep + (6 - soreness) + (6 - stress) + motivation) - 4) / 16 * 100;
  return Math.round(raw);
}

interface ReadinessTier {
  label: string;
  textColor: string;
  barColor: string;
  trackColor: string;
}

function getReadinessTier(score: number): ReadinessTier {
  if (score >= 85) return { label: 'Peak', textColor: 'text-emerald-600', barColor: 'bg-emerald-500', trackColor: 'bg-emerald-100' };
  if (score >= 70) return { label: 'Good to train', textColor: 'text-green-600', barColor: 'bg-green-500', trackColor: 'bg-green-100' };
  if (score >= 55) return { label: 'Moderate', textColor: 'text-yellow-600', barColor: 'bg-yellow-500', trackColor: 'bg-yellow-100' };
  if (score >= 40) return { label: 'Low', textColor: 'text-orange-600', barColor: 'bg-orange-500', trackColor: 'bg-orange-100' };
  return { label: 'Very Low', textColor: 'text-red-600', barColor: 'bg-red-500', trackColor: 'bg-red-100' };
}

function calcStreak(allWorkouts: Workout[]): number {
  if (allWorkouts.length === 0) return 0;
  const days = new Set(allWorkouts.map(w => new Date(w.created_at).toDateString()));
  const today = new Date();
  let streak = 0;
  const cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(today.toDateString())) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calcBestStreak(allWorkouts: Workout[]): number {
  if (allWorkouts.length === 0) return 0;
  const daySet = new Set(
    allWorkouts.map(w => {
      const d = new Date(w.created_at);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }),
  );
  const sorted = [...daySet].sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  let best = 1, cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] === 86400000) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 1;
    }
  }
  return best;
}

const defaultSet = () => ({ reps: 0, weight: 0 });

// ── Filter options ─────────────────────────────────────────────────────────────

type FilterCategory = 'all' | SessionType;

const FILTER_OPTIONS: { label: string; value: FilterCategory }[] = [
  { label: 'All', value: 'all' },
  { label: 'Lifting', value: 'lifting' },
  { label: 'Running', value: 'running' },
  { label: 'Cycling', value: 'cycling' },
];

// ── EditOverlay ────────────────────────────────────────────────────────────────

interface EditOverlayProps {
  workout: Workout;
  onClose: () => void;
  onSaved: (updated: Workout) => void;
}

function EditOverlay({ workout, onClose, onSaved }: EditOverlayProps) {
  const [name, setName] = useState(workout.name);
  const [duration, setDuration] = useState(workout.duration ? String(Math.round(workout.duration / 60)) : '');
  const [workoutDate, setWorkoutDate] = useState(toDatetimeLocal(workout.created_at));
  const [saving, setSaving] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exercises, setExercises] = useState<ExerciseEntry[]>([{ name: '', sets: [defaultSet()] }]);
  const [liftingRpe, setLiftingRpe] = useState('');

  const [runDistance, setRunDistance] = useState('');
  const [runType, setRunType] = useState<string>('easy');
  const [runAvgHR, setRunAvgHR] = useState('');
  const [runMaxHR, setRunMaxHR] = useState('');
  const [runElevGain, setRunElevGain] = useState('');
  const [runNotes, setRunNotes] = useState('');
  const [runRpe, setRunRpe] = useState('');

  const [cycleDistance, setCycleDistance] = useState('');
  const [cycleType, setCycleType] = useState<string>('easy');
  const [cycleAvgPower, setCycleAvgPower] = useState('');
  const [cycleAvgHR, setCycleAvgHR] = useState('');
  const [cycleMaxHR, setCycleMaxHR] = useState('');
  const [cycleCadence, setCycleCadence] = useState('');
  const [cycleElevGain, setCycleElevGain] = useState('');
  const [cycleRpe, setCycleRpe] = useState('');
  const [cycleNotes, setCycleNotes] = useState('');

  const durationNum = parseFloat(duration) || 0;
  const runPace = computePace(parseFloat(runDistance) || 0, durationNum);
  const cycleSpeed = computeSpeed(parseFloat(cycleDistance) || 0, durationNum);

  useEffect(() => {
    const supabase = createClient();
    async function load() {
      if (workout.session_type === 'running') {
        const { data } = await supabase
          .from('running_sessions')
          .select('distance, run_type, elevation_gain, avg_heart_rate, max_heart_rate, notes')
          .eq('workout_id', workout.id)
          .maybeSingle();
        if (data) {
          const rs = data as RunningSessionFull;
          setRunDistance(String(rs.distance));
          setRunType(rs.run_type);
          setRunElevGain(rs.elevation_gain != null ? String(rs.elevation_gain) : '');
          setRunAvgHR(rs.avg_heart_rate != null ? String(rs.avg_heart_rate) : '');
          setRunMaxHR(rs.max_heart_rate != null ? String(rs.max_heart_rate) : '');
          setRunNotes(rs.notes ?? '');
        }
        setRunRpe(workout.rpe != null ? String(workout.rpe) : '');
      } else if (workout.session_type === 'cycling') {
        const { data } = await supabase
          .from('cycling_sessions')
          .select('distance, ride_type, elevation_gain, avg_power, avg_heart_rate, max_heart_rate, avg_cadence, notes')
          .eq('workout_id', workout.id)
          .maybeSingle();
        if (data) {
          const cs = data as CyclingSessionFull;
          setCycleDistance(String(cs.distance));
          setCycleType(cs.ride_type);
          setCycleElevGain(cs.elevation_gain != null ? String(cs.elevation_gain) : '');
          setCycleAvgPower(cs.avg_power != null ? String(cs.avg_power) : '');
          setCycleAvgHR(cs.avg_heart_rate != null ? String(cs.avg_heart_rate) : '');
          setCycleMaxHR(cs.max_heart_rate != null ? String(cs.max_heart_rate) : '');
          setCycleCadence(cs.avg_cadence != null ? String(cs.avg_cadence) : '');
          setCycleNotes(cs.notes ?? '');
        }
        setCycleRpe(workout.rpe != null ? String(workout.rpe) : '');
      } else {
        const { data: weData } = await supabase
          .from('workout_exercises')
          .select('id, exercise_order, exercises(name), workout_sets(set_number, reps, weight)')
          .eq('workout_id', workout.id)
          .order('exercise_order', { ascending: true });
        if (weData && weData.length > 0) {
          setExercises(
            (weData as any[]).map(we => ({
              name: we.exercises?.name ?? '',
              sets: (we.workout_sets ?? [])
                .sort((a: any, b: any) => a.set_number - b.set_number)
                .map((s: any) => ({ reps: s.reps, weight: s.weight })),
            })),
          );
        }
        setLiftingRpe(workout.rpe != null ? String(workout.rpe) : '');
      }
      setLoadingDetails(false);
    }
    load();
  }, [workout.id, workout.session_type, workout.rpe]);

  const addExercise = () => setExercises(prev => [...prev, { name: '', sets: [defaultSet()] }]);
  const removeExercise = (i: number) => setExercises(prev => prev.filter((_, idx) => idx !== i));
  const updateExerciseName = (i: number, n: string) =>
    setExercises(prev => prev.map((ex, idx) => (idx === i ? { ...ex, name: n } : ex)));
  const addSet = (i: number) =>
    setExercises(prev => prev.map((ex, idx) => (idx === i ? { ...ex, sets: [...ex.sets, defaultSet()] } : ex)));
  const removeSet = (exI: number, sI: number) =>
    setExercises(prev => prev.map((ex, idx) => (idx === exI ? { ...ex, sets: ex.sets.filter((_, si) => si !== sI) } : ex)));
  const updateSet = (exI: number, sI: number, field: 'reps' | 'weight', val: number) =>
    setExercises(prev =>
      prev.map((ex, idx) =>
        idx === exI ? { ...ex, sets: ex.sets.map((s, si) => (si === sI ? { ...s, [field]: val } : s)) } : ex,
      ),
    );

  async function handleSave() {
    setError(null);
    setSaving(true);
    const supabase = createClient();
    try {
      const durationSeconds = duration ? parseInt(duration) * 60 : workout.duration;
      if (workout.session_type === 'running') {
        const distKm = parseFloat(runDistance) || 0;
        const avgPace = durationSeconds > 0 && distKm > 0 ? Math.round(durationSeconds / distKm) : null;
        const { error: wErr } = await supabase.from('workouts').update({
          name: name.trim() || workout.name,
          duration: durationSeconds,
          rpe: runRpe ? parseFloat(runRpe) : null,
          created_at: new Date(workoutDate).toISOString(),
        }).eq('id', workout.id);
        if (wErr) { setError(wErr.message); return; }
        const { error: sErr } = await supabase.from('running_sessions').update({
          distance: distKm,
          run_type: runType,
          elevation_gain: runElevGain ? parseFloat(runElevGain) : null,
          avg_heart_rate: runAvgHR ? parseInt(runAvgHR) : null,
          max_heart_rate: runMaxHR ? parseInt(runMaxHR) : null,
          avg_pace: avgPace,
          notes: runNotes || null,
        }).eq('workout_id', workout.id);
        if (sErr) { setError(sErr.message); return; }
      } else if (workout.session_type === 'cycling') {
        const distKm = parseFloat(cycleDistance) || 0;
        const avgSpeed =
          durationSeconds > 0 && distKm > 0
            ? parseFloat((distKm / (durationSeconds / 3600)).toFixed(1))
            : null;
        const { error: wErr } = await supabase.from('workouts').update({
          name: name.trim() || workout.name,
          duration: durationSeconds,
          rpe: cycleRpe ? parseFloat(cycleRpe) : null,
          created_at: new Date(workoutDate).toISOString(),
        }).eq('id', workout.id);
        if (wErr) { setError(wErr.message); return; }
        const { error: sErr } = await supabase.from('cycling_sessions').update({
          distance: distKm,
          ride_type: cycleType,
          elevation_gain: cycleElevGain ? parseFloat(cycleElevGain) : null,
          avg_power: cycleAvgPower ? parseInt(cycleAvgPower) : null,
          avg_heart_rate: cycleAvgHR ? parseInt(cycleAvgHR) : null,
          max_heart_rate: cycleMaxHR ? parseInt(cycleMaxHR) : null,
          avg_cadence: cycleCadence ? parseInt(cycleCadence) : null,
          avg_speed: avgSpeed,
          notes: cycleNotes || null,
        }).eq('workout_id', workout.id);
        if (sErr) { setError(sErr.message); return; }
      } else {
        const { error: wErr } = await supabase.from('workouts').update({
          name: name.trim() || workout.name,
          duration: durationSeconds,
          rpe: liftingRpe ? parseFloat(liftingRpe) : null,
          created_at: new Date(workoutDate).toISOString(),
        }).eq('id', workout.id);
        if (wErr) { setError(wErr.message); return; }
        const { data: existingWE } = await supabase.from('workout_exercises').select('id').eq('workout_id', workout.id);
        const weIds = (existingWE ?? []).map((r: any) => r.id);
        if (weIds.length > 0) await supabase.from('workout_sets').delete().in('workout_exercise_id', weIds);
        await supabase.from('workout_exercises').delete().eq('workout_id', workout.id);
        for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
          const ex = exercises[exIdx];
          if (!ex.name.trim()) continue;
          const { data: existing } = await supabase.from('exercises').select('id').eq('name', ex.name.trim()).maybeSingle();
          let exerciseId: string;
          if (existing) {
            exerciseId = existing.id;
          } else {
            const { data: newEx, error: exErr } = await supabase.from('exercises').insert({ name: ex.name.trim() }).select('id').single();
            if (exErr || !newEx) { setError(exErr?.message ?? 'Failed to save exercise.'); return; }
            exerciseId = newEx.id;
          }
          const { data: we, error: weErr } = await supabase
            .from('workout_exercises')
            .insert({ workout_id: workout.id, exercise_id: exerciseId, exercise_order: exIdx + 1 })
            .select('id')
            .single();
          if (weErr || !we) { setError(weErr?.message ?? 'Failed to save exercise.'); return; }
          const { error: setsErr } = await supabase.from('workout_sets').insert(
            ex.sets.map((s, si) => ({ workout_exercise_id: we.id, set_number: si + 1, reps: s.reps, weight: s.weight })),
          );
          if (setsErr) { setError(setsErr.message); return; }
        }
      }
      onSaved({
        ...workout,
        name: name.trim() || workout.name,
        duration: duration ? parseInt(duration) * 60 : workout.duration,
        rpe:
          workout.session_type === 'lifting'
            ? liftingRpe ? parseFloat(liftingRpe) : null
            : workout.session_type === 'running'
              ? runRpe ? parseFloat(runRpe) : null
              : cycleRpe ? parseFloat(cycleRpe) : null,
        created_at: new Date(workoutDate).toISOString(),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative ml-auto w-full max-w-xl h-full bg-[#FAF7F2] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EDE5DB] bg-[#FAF7F2] shrink-0">
          <div>
            <p className={`${sectionLabelCls} mb-0.5`}>Edit session</p>
            <h2 className="text-lg font-bold text-[#1C1612]">{workout.name}</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#EDE5DB] text-[#9B8575] hover:text-[#1C1612] transition-colors text-xl leading-none">×</button>
        </div>
        <div className="px-6 pt-4 shrink-0">
          <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[workout.session_type]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${CATEGORY_DOT[workout.session_type]}`} />
            {CATEGORY_LABELS[workout.session_type]}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingDetails ? (
            <div className="flex items-center justify-center py-16 text-[#9B8575] text-sm">Loading…</div>
          ) : (
            <div className="flex flex-col gap-5 pb-6">
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>Session name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>Duration (minutes)</label>
                <input type="number" min={0} value={duration} onChange={e => setDuration(e.target.value)} placeholder="e.g. 45" className={inputCls} />
              </div>

              {workout.session_type === 'lifting' && (
                <>
                  {exercises.map((ex, exIdx) => (
                    <div key={exIdx} className={cardCls}>
                      <div className="flex items-center gap-2">
                        <input type="text" value={ex.name} onChange={e => updateExerciseName(exIdx, e.target.value)} placeholder="Exercise name" className={`${inputCls} flex-1 font-medium`} />
                        {exercises.length > 1 && (
                          <button type="button" onClick={() => removeExercise(exIdx)} className="text-[#CCC1B5] hover:text-red-400 text-sm px-2 transition-colors">Remove</button>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2">
                          <span /><span className={`${sectionLabelCls} text-center`}>Reps</span><span className={`${sectionLabelCls} text-center`}>kg</span><span />
                        </div>
                        {ex.sets.map((s, sIdx) => (
                          <div key={sIdx} className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center">
                            <span className="text-xs text-[#9B8575] text-center font-semibold">{sIdx + 1}</span>
                            <input type="number" min={0} value={s.reps === 0 ? '' : s.reps} onChange={e => updateSet(exIdx, sIdx, 'reps', Number(e.target.value))} placeholder="0" className={`${inputCls} text-center`} />
                            <input type="number" min={0} step={0.5} value={s.weight === 0 ? '' : s.weight} onChange={e => updateSet(exIdx, sIdx, 'weight', Number(e.target.value))} placeholder="0" className={`${inputCls} text-center`} />
                            {ex.sets.length > 1 ? (
                              <button type="button" onClick={() => removeSet(exIdx, sIdx)} className="text-[#CCC1B5] hover:text-red-400 text-lg leading-none transition-colors">×</button>
                            ) : <span />}
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addSet(exIdx)} className="self-start text-xs font-semibold text-[#9B8575] hover:text-[#C4622A] transition-colors tracking-wide uppercase">+ Add set</button>
                    </div>
                  ))}
                  <button type="button" onClick={addExercise} className="border border-dashed border-[#EDE5DB] rounded-2xl py-3.5 text-sm font-semibold text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A] transition-colors">+ Add exercise</button>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Perceived effort (RPE)</p>
                    <div className="flex gap-1.5">
                      {RPE_VALUES.map(v => (
                        <button key={v} type="button" onClick={() => setLiftingRpe(String(v))} className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${liftingRpe === String(v) ? 'bg-[#C4622A] border-[#C4622A] text-white' : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {workout.session_type === 'running' && (
                <>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Distance & pace</p>
                    <input type="number" min={0} step={0.01} value={runDistance} onChange={e => setRunDistance(e.target.value)} placeholder="0.00 km" className={`${inputCls} text-2xl font-bold tracking-tight`} style={{ fontFamily: 'Georgia, serif' }} />
                    {runPace && (
                      <div className="flex items-center justify-between bg-[#FDF1EA] border border-[#ECD5C5] rounded-xl px-4 py-3">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C4622A]">Avg pace</span>
                        <span className="text-xl font-bold text-[#C4622A]" style={{ fontFamily: 'Georgia, serif' }}>{runPace}</span>
                      </div>
                    )}
                  </div>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Run type</p>
                    <div className="flex flex-wrap gap-2">
                      {RUN_TYPES.map(t => (
                        <button key={t} type="button" onClick={() => setRunType(t)} className={`px-4 py-1.5 rounded-full border text-sm font-semibold capitalize transition-all ${runType === t ? 'bg-[#C4622A] border-[#C4622A] text-white' : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Heart rate & elevation</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5"><label className={fieldLabelCls}>Avg HR (bpm)</label><input type="number" min={0} value={runAvgHR} onChange={e => setRunAvgHR(e.target.value)} placeholder="148" className={inputCls} /></div>
                      <div className="flex flex-col gap-1.5"><label className={fieldLabelCls}>Max HR (bpm)</label><input type="number" min={0} value={runMaxHR} onChange={e => setRunMaxHR(e.target.value)} placeholder="172" className={inputCls} /></div>
                      <div className="flex flex-col gap-1.5 col-span-2"><label className={fieldLabelCls}>Elevation gain (m)</label><input type="number" min={0} value={runElevGain} onChange={e => setRunElevGain(e.target.value)} placeholder="120" className={inputCls} /></div>
                    </div>
                  </div>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Perceived effort (RPE)</p>
                    <div className="flex gap-1.5">
                      {RPE_VALUES.map(v => (
                        <button key={v} type="button" onClick={() => setRunRpe(String(v))} className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${runRpe === String(v) ? 'bg-[#C4622A] border-[#C4622A] text-white' : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Notes <span className="text-[#CCC1B5] font-normal">(optional)</span></label>
                    <textarea value={runNotes} onChange={e => setRunNotes(e.target.value)} rows={3} placeholder="How did it feel?" className={`${inputCls} resize-none`} />
                  </div>
                </>
              )}

              {workout.session_type === 'cycling' && (
                <>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Distance & speed</p>
                    <input type="number" min={0} step={0.01} value={cycleDistance} onChange={e => setCycleDistance(e.target.value)} placeholder="0.00 km" className={`${inputCls} text-2xl font-bold tracking-tight`} style={{ fontFamily: 'Georgia, serif' }} />
                    {cycleSpeed && (
                      <div className="flex items-center justify-between bg-[#FDF1EA] border border-[#ECD5C5] rounded-xl px-4 py-3">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C4622A]">Avg speed</span>
                        <span className="text-xl font-bold text-[#C4622A]" style={{ fontFamily: 'Georgia, serif' }}>{cycleSpeed}</span>
                      </div>
                    )}
                  </div>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Ride type</p>
                    <div className="flex flex-wrap gap-2">
                      {CYCLE_TYPES.map(t => (
                        <button key={t} type="button" onClick={() => setCycleType(t)} className={`px-4 py-1.5 rounded-full border text-sm font-semibold capitalize transition-all ${cycleType === t ? 'bg-[#C4622A] border-[#C4622A] text-white' : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'}`}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Power & cadence</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5"><label className={fieldLabelCls}>Avg power (W)</label><input type="number" min={0} value={cycleAvgPower} onChange={e => setCycleAvgPower(e.target.value)} placeholder="210" className={inputCls} /></div>
                      <div className="flex flex-col gap-1.5"><label className={fieldLabelCls}>Avg cadence (rpm)</label><input type="number" min={0} value={cycleCadence} onChange={e => setCycleCadence(e.target.value)} placeholder="88" className={inputCls} /></div>
                    </div>
                  </div>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Heart rate & elevation</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1.5"><label className={fieldLabelCls}>Avg HR (bpm)</label><input type="number" min={0} value={cycleAvgHR} onChange={e => setCycleAvgHR(e.target.value)} placeholder="142" className={inputCls} /></div>
                      <div className="flex flex-col gap-1.5"><label className={fieldLabelCls}>Max HR (bpm)</label><input type="number" min={0} value={cycleMaxHR} onChange={e => setCycleMaxHR(e.target.value)} placeholder="168" className={inputCls} /></div>
                      <div className="flex flex-col gap-1.5 col-span-2"><label className={fieldLabelCls}>Elevation gain (m)</label><input type="number" min={0} value={cycleElevGain} onChange={e => setCycleElevGain(e.target.value)} placeholder="850" className={inputCls} /></div>
                    </div>
                  </div>
                  <div className={cardCls}>
                    <p className={sectionLabelCls}>Perceived effort (RPE)</p>
                    <div className="flex gap-1.5">
                      {RPE_VALUES.map(v => (
                        <button key={v} type="button" onClick={() => setCycleRpe(String(v))} className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${cycleRpe === String(v) ? 'bg-[#C4622A] border-[#C4622A] text-white' : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'}`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Notes <span className="text-[#CCC1B5] font-normal">(optional)</span></label>
                    <textarea value={cycleNotes} onChange={e => setCycleNotes(e.target.value)} rows={3} placeholder="How did it feel?" className={`${inputCls} resize-none`} />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>Date & Time</label>
                <input type="datetime-local" value={workoutDate} onChange={e => setWorkoutDate(e.target.value)} className={inputCls} />
              </div>

              {error && <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>}
            </div>
          )}
        </div>
        <div className="shrink-0 px-6 py-4 border-t border-[#EDE5DB] bg-[#FAF7F2] flex gap-3">
          <button onClick={onClose} className="flex-1 rounded-xl border border-[#EDE5DB] py-3 text-sm font-semibold text-[#9B8575] hover:bg-[#EDE5DB] transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || loadingDetails} className="flex-1 rounded-xl bg-[#1C1612] py-3 text-sm font-semibold text-[#FAF7F2] hover:bg-[#2C2218] transition-colors disabled:opacity-50">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── WorkoutCard ────────────────────────────────────────────────────────────────

interface WorkoutCardProps {
  workout: Workout;
  runningSessions: Record<string, RunningSession>;
  cyclingSessions: Record<string, CyclingSession>;
  profileWeight: number | null;
  onEdit: (w: Workout) => void;
  onDelete: (id: string) => void;
}

function WorkoutCard({ workout: w, runningSessions, cyclingSessions, profileWeight, onEdit, onDelete }: WorkoutCardProps) {
  const [confirming, setConfirming] = useState(false);
  const subtitle = workoutSubtitle(w, runningSessions, cyclingSessions);
  const kcal = calcDayKcal([w], runningSessions, cyclingSessions, profileWeight);

  return (
    <div className="bg-white rounded-xl border border-[#EDE5DB] p-3 flex flex-col gap-2 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-[12.5px] font-bold text-[#1C1612] leading-tight truncate tracking-[-0.2px]">{w.name}</h3>
          {subtitle && <p className="text-[10.5px] text-gray-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${CATEGORY_COLORS[w.session_type]}`}>
          {CATEGORY_LABELS[w.session_type]}
        </span>
      </div>

      <div className="flex gap-2.5 flex-wrap">
        {w.duration > 0 && (
          <span className="text-[10.5px] text-gray-500 flex items-center gap-1">⏱ {formatDuration(w.duration)}</span>
        )}
        {w.rpe != null && (
          <span className="text-[10.5px] text-gray-500 flex items-center gap-1">⚡ RPE {w.rpe}</span>
        )}
        {kcal > 0 && (
          <span className="text-[10.5px] font-semibold text-[#C4622A] flex items-center gap-1">🔥 {kcal.toLocaleString()} kcal</span>
        )}
      </div>

      <div className="flex gap-1.5 pt-1.5 border-t border-gray-100">
        <button
          onClick={() => onEdit(w)}
          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-[#EDE5DB] py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
          Edit
        </button>
        {confirming ? (
          <div className="flex-1 flex gap-1">
            <button onClick={() => setConfirming(false)} className="flex-1 rounded-lg border border-[#EDE5DB] py-1.5 text-[11px] font-medium text-gray-500 hover:bg-gray-50 transition-colors">No</button>
            <button onClick={() => onDelete(w.id)} className="flex-1 rounded-lg bg-red-500 py-1.5 text-[11px] font-medium text-white hover:bg-red-600 transition-colors">Yes</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-red-100 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-50 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

const todayDowIdx = (() => {
  const dow = new Date().getDay();
  return dow === 0 ? 6 : dow - 1;
})();

export default function Dashboard() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runningSessions, setRunningSessions] = useState<Record<string, RunningSession>>({});
  const [cyclingSessions, setCyclingSessions] = useState<Record<string, CyclingSession>>({});
  const [profileWeight, setProfileWeight] = useState<number | null>(null);
  const [profileTDEEBase, setProfileTDEEBase] = useState<number | null>(null);
  const [profileCalorieAdjustment, setProfileCalorieAdjustment] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [editTarget, setEditTarget] = useState<Workout | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDayIdx, setSelectedDayIdx] = useState(todayDowIdx);
  const [dailyLogs, setDailyLogs] = useState<Record<string, DailyLog>>({});

  // Fetch all workouts + profile once
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const [{ data: workoutData }, { data: profileData }] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, name, created_at, duration, rpe, session_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profile')
          .select('weight, height, age, sex, activity_level, calorie_adjustment')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const all: Workout[] = workoutData ?? [];
      setWorkouts(all);
      const p = profileData as any;
      setProfileWeight(p?.weight ?? null);
      setProfileCalorieAdjustment(p?.calorie_adjustment ?? 0);
      if (p?.weight && p?.height && p?.age && p?.sex) {
        setProfileTDEEBase(calculateTDEE(calculateBMR(p.weight, p.height, p.age, p.sex), p.activity_level, 0));
      }

      const runIds = all.filter(w => w.session_type === 'running').map(w => w.id);
      const cycleIds = all.filter(w => w.session_type === 'cycling').map(w => w.id);

      await Promise.all([
        runIds.length > 0
          ? supabase.from('running_sessions')
              .select('workout_id, distance, run_type, elevation_gain')
              .in('workout_id', runIds)
              .then(({ data }) => {
                const map: Record<string, RunningSession> = {};
                for (const r of data ?? []) map[r.workout_id] = r as RunningSession;
                setRunningSessions(map);
              })
          : Promise.resolve(),
        cycleIds.length > 0
          ? supabase.from('cycling_sessions')
              .select('workout_id, distance, ride_type, elevation_gain, avg_power')
              .in('workout_id', cycleIds)
              .then(({ data }) => {
                const map: Record<string, CyclingSession> = {};
                for (const r of data ?? []) map[r.workout_id] = r as CyclingSession;
                setCyclingSessions(map);
              })
          : Promise.resolve(),
      ]);

      setLoading(false);
    });
  }, []);

  // Fetch daily logs for the displayed week
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const mon = getWeekMonday(weekOffset);
      const sun = addDays(mon, 6);
      const { data } = await supabase
        .from('daily_logs')
        .select('log_date, weight, sleep, soreness, stress, motivation')
        .eq('user_id', user.id)
        .gte('log_date', toLogDateStr(mon))
        .lte('log_date', toLogDateStr(sun));
      const map: Record<string, DailyLog> = {};
      for (const log of data ?? []) map[log.log_date] = log as DailyLog;
      setDailyLogs(map);
    });
  }, [weekOffset]);

  const monday = useMemo(() => getWeekMonday(weekOffset), [weekOffset]);
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(monday, i)), [monday]);
  const sunday = weekDays[6];

  const filtered = useMemo(() => {
    return workouts.filter(w => {
      if (filter !== 'all' && w.session_type !== filter) return false;
      if (search.trim() && !w.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
      return true;
    });
  }, [workouts, filter, search]);

  const byDay = useMemo(() => {
    const map: Record<string, Workout[]> = {};
    for (const w of filtered) {
      const key = toDateKey(new Date(w.created_at));
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }
    return map;
  }, [filtered]);

  const weekLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
  }, [monday, sunday]);

  const weekWorkoutCount = weekDays.reduce((sum, d) => sum + (byDay[toDateKey(d)]?.length ?? 0), 0);
  const streak = useMemo(() => calcStreak(workouts), [workouts]);
  const bestStreak = useMemo(() => calcBestStreak(workouts), [workouts]);
  const todayKey = toDateKey(new Date());

  // Right panel — selected day
  const selectedDay = weekDays[selectedDayIdx];
  const selectedDayLogKey = toLogDateStr(selectedDay);
  const selectedLog = dailyLogs[selectedDayLogKey] ?? null;
  const readinessScore =
    selectedLog?.sleep != null &&
    selectedLog?.soreness != null &&
    selectedLog?.stress != null &&
    selectedLog?.motivation != null
      ? computeReadiness(selectedLog.sleep, selectedLog.soreness, selectedLog.stress, selectedLog.motivation)
      : null;
  const readinessTier = readinessScore !== null ? getReadinessTier(readinessScore) : null;
  const selectedDayLabel = selectedDay.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });
  const selectedDayWorkouts = byDay[toDateKey(selectedDay)] ?? [];
  const selectedDayWorkoutKcal = calcDayKcal(selectedDayWorkouts, runningSessions, cyclingSessions, profileWeight);
  const selectedDayTotalKcal = selectedDayWorkoutKcal + (profileTDEEBase ?? 0) + profileCalorieAdjustment;

  // Last 14 days for streak grid
  const workoutDaySet = useMemo(() => new Set(workouts.map(w => new Date(w.created_at).toDateString())), [workouts]);
  const last14Days = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 13 + i);
    d.setHours(0, 0, 0, 0);
    return d;
  }), []);

  async function handleDelete(id: string) {
    const supabase = createClient();
    await supabase.from('workouts').delete().eq('id', id);
    setWorkouts(prev => prev.filter(w => w.id !== id));
  }

  function handleSaved(updated: Workout) {
    setWorkouts(prev => prev.map(w => (w.id === updated.id ? updated : w)));
    if (updated.session_type === 'running') {
      createClient()
        .from('running_sessions')
        .select('workout_id, distance, run_type, elevation_gain')
        .eq('workout_id', updated.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setRunningSessions(prev => ({ ...prev, [updated.id]: data as RunningSession }));
        });
    } else if (updated.session_type === 'cycling') {
      createClient()
        .from('cycling_sessions')
        .select('workout_id, distance, ride_type, elevation_gain, avg_power')
        .eq('workout_id', updated.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCyclingSessions(prev => ({ ...prev, [updated.id]: data as CyclingSession }));
        });
    }
    setEditTarget(null);
  }

  return (
    <div className="h-screen overflow-hidden flex">
      <Sidebar />

      <div className="flex flex-1 overflow-hidden">

        {/* ── Calendar column ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#f5f4f0]">

          {/* Top bar */}
          <div className="px-6 pt-6 pb-3 shrink-0">
            <div className="flex items-start justify-between mb-3.5">
              <div>
                <h1 className="text-[22px] font-bold text-[#1C1612] tracking-[-0.4px] leading-tight">Dashboard</h1>
                <p className="text-[12.5px] text-gray-500 mt-0.5">{workouts.length} total · {weekWorkoutCount} this week</p>
              </div>
            </div>
            <div className="flex gap-2.5 items-center">
              {/* Search */}
              <div className="relative flex-1 max-w-[260px]">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2" /><line x1="21" y1="21" x2="16.65" y2="16.65" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-[7px] rounded-xl border border-gray-200 bg-white text-[13px] text-[#1C1612] placeholder-gray-400 focus:outline-none focus:border-gray-400 shadow-sm"
                />
              </div>
              {/* Filter tabs */}
              <div className="flex gap-[3px] bg-white rounded-xl border border-gray-200 p-[3px] shadow-sm">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`px-3 py-[5px] rounded-[9px] text-xs font-medium transition-colors ${
                      filter === opt.value ? 'bg-[#1C1612] text-white' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Week nav */}
          <div className="px-6 pb-3 shrink-0 flex items-center gap-2.5">
            <button
              onClick={() => setWeekOffset(o => o - 1)}
              className="w-[30px] h-[30px] flex items-center justify-center rounded-[9px] border border-gray-200 bg-white hover:bg-[#f5f4f0] text-gray-500 shadow-sm transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="text-[13px] font-semibold text-gray-700 min-w-[180px] text-center">{weekLabel}</span>
            <button
              onClick={() => setWeekOffset(o => o + 1)}
              disabled={weekOffset >= 0}
              className="w-[30px] h-[30px] flex items-center justify-center rounded-[9px] border border-gray-200 bg-white hover:bg-[#f5f4f0] text-gray-500 shadow-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
            </button>
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-[11.5px] font-medium text-gray-500 underline underline-offset-2 hover:text-gray-800 transition-colors">
                Today
              </button>
            )}
          </div>

          {/* Calendar grid */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading…</div>
          ) : (
            <div className="flex-1 overflow-x-auto px-6 pb-6">
              <div className="grid grid-cols-7 gap-2.5 min-w-[700px] h-full">
                {weekDays.map((day, i) => {
                  const key = toDateKey(day);
                  const isToday = key === todayKey;
                  const isSelected = i === selectedDayIdx;
                  const dayWorkouts = byDay[key] ?? [];
                  const kcal = calcDayKcal(dayWorkouts, runningSessions, cyclingSessions, profileWeight);
                  const totalKcal = kcal + (profileTDEEBase ?? 0) + profileCalorieAdjustment;

                  return (
                    <div key={i} className="flex flex-col gap-2 min-w-0">
                      {/* Day header */}
                      <button
                        onClick={() => setSelectedDayIdx(i)}
                        className={`rounded-xl p-2.5 text-center border transition-colors w-full ${
                          isToday
                            ? 'bg-[#1C1612] border-[#1C1612]'
                            : isSelected
                              ? 'bg-[#1C1612]/[0.05] border-[#1C1612]/20'
                              : 'bg-white border-gray-100 shadow-sm hover:border-gray-300'
                        }`}
                      >
                        <p className={`text-[9.5px] font-bold uppercase tracking-[0.5px] ${isToday ? 'text-gray-400' : 'text-gray-400'}`}>
                          {DAY_LABELS[i]}
                        </p>
                        <p className={`text-xl font-bold mt-0.5 leading-none tracking-[-0.5px] ${isToday ? 'text-white' : 'text-[#1C1612]'}`}>
                          {day.getDate()}
                        </p>
                        <p className={`text-[9.5px] mt-0.5 ${isToday ? 'text-gray-400' : 'text-gray-400'}`}>
                          {day.toLocaleDateString('en-GB', { month: 'short' })}
                        </p>
                        {totalKcal > 0 ? (
                          <div className={`mt-1.5 rounded-[7px] px-1.5 py-[3px] text-[9.5px] font-semibold ${
                            isToday
                              ? 'bg-white/10 text-orange-300'
                              : 'bg-orange-50 text-[#C4622A] border border-orange-100'
                          }`}>
                            {totalKcal.toLocaleString()} kcal
                          </div>
                        ) : (
                          <div className={`mt-1.5 text-[9.5px] ${isToday ? 'text-gray-500' : 'text-gray-300'}`}>— kcal</div>
                        )}
                      </button>

                      {/* Workout cards */}
                      <div className="flex flex-col gap-2 flex-1">
                        {dayWorkouts.map(w => (
                          <WorkoutCard
                            key={w.id}
                            workout={w}
                            runningSessions={runningSessions}
                            cyclingSessions={cyclingSessions}
                            profileWeight={profileWeight}
                            onEdit={setEditTarget}
                            onDelete={handleDelete}
                          />
                        ))}
                        {dayWorkouts.length === 0 && (
                          <Link
                            href="/workout"
                            className={`rounded-xl border border-dashed py-5 flex items-center justify-center text-xs transition-colors ${
                              isToday
                                ? 'border-gray-400 text-gray-400 hover:border-gray-500 hover:text-gray-500'
                                : 'border-gray-200 text-gray-300 hover:border-gray-400 hover:text-gray-500'
                            }`}
                          >
                            + Add workout
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel ── */}
        <div className="w-[270px] shrink-0 border-l border-[#EDE5DB] bg-white flex flex-col overflow-y-auto h-screen">

          {/* Zone 1: Readiness */}
          <div className="px-5 pt-[22px] pb-[18px] border-b border-[#EDE5DB] shrink-0">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#9B8575] mb-3">Readiness</p>
            {readinessScore !== null && readinessTier ? (
              <div className="flex items-center gap-3">
                <div className={`text-[56px] font-bold leading-none tracking-[-3px] ${readinessTier.textColor}`}>
                  {readinessScore}
                </div>
                <div className="flex-1">
                  <div className={`text-[13px] font-bold ${readinessTier.textColor}`}>{readinessTier.label}</div>
                  <div className="text-[10.5px] text-[#9B8575] mt-0.5">Sleep · Soreness · Motivation</div>
                  <div className={`h-[5px] ${readinessTier.trackColor} rounded-full mt-2.5 overflow-hidden`}>
                    <div className={`h-full ${readinessTier.barColor} rounded-full`} style={{ width: `${readinessScore}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[12.5px] text-gray-400">Log today to see readiness</p>
            )}
          </div>

          {/* Zone 2: Day context */}
          <div className="px-5 py-[10px] border-b border-[#EDE5DB] bg-[#faf9f7] flex items-center justify-between shrink-0">
            <div>
              <div className="text-[12.5px] font-bold text-[#1C1612]">{selectedDayLabel}</div>
              <div className="text-[10.5px] text-gray-500 mt-0.5">Tap a day to view its log</div>
            </div>
            <Link
              href="/daily-log"
              className="text-[11px] font-medium text-gray-500 bg-white border border-[#EDE5DB] rounded-lg px-2.5 py-1 hover:text-[#1C1612] hover:border-gray-400 transition-colors"
            >
              Edit
            </Link>
          </div>

          {/* Zone 3: Log fields */}
          <div className="border-b border-[#EDE5DB] shrink-0">
            {/* Body weight */}
            <div className="flex items-center justify-between px-5 py-[9px] border-b border-[#faf9f7]">
              <div className="flex items-center gap-[9px] text-[12px] font-medium text-gray-500">
                <div className="w-6 h-6 rounded-[7px] bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                </div>
                Body weight
              </div>
              <div className={`tracking-[-0.3px] ${selectedLog?.weight ? 'text-[13.5px] font-bold text-[#1C1612]' : 'text-[11.5px] text-gray-400'}`}>
                {selectedLog?.weight != null ? `${selectedLog.weight} kg` : '—'}
              </div>
            </div>

            {/* Soreness */}
            <div className="flex items-center justify-between px-5 py-[9px] border-b border-[#faf9f7]">
              <div className="flex items-center gap-[9px] text-[12px] font-medium text-gray-500">
                <div className="w-6 h-6 rounded-[7px] bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg>
                </div>
                Soreness
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className={`w-2 h-2 rounded-full ${selectedLog?.soreness != null && n <= selectedLog.soreness ? 'bg-orange-400' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>

            {/* Stress */}
            <div className="flex items-center justify-between px-5 py-[9px] border-b border-[#faf9f7]">
              <div className="flex items-center gap-[9px] text-[12px] font-medium text-gray-500">
                <div className="w-6 h-6 rounded-[7px] bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" /></svg>
                </div>
                Stress
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className={`w-2 h-2 rounded-full ${selectedLog?.stress != null && n <= selectedLog.stress ? 'bg-orange-400' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>

            {/* Motivation */}
            <div className="flex items-center justify-between px-5 py-[9px] border-b border-[#faf9f7]">
              <div className="flex items-center gap-[9px] text-[12px] font-medium text-gray-500">
                <div className="w-6 h-6 rounded-[7px] bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </div>
                Motivation
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <div key={n} className={`w-2 h-2 rounded-full ${selectedLog?.motivation != null && n <= selectedLog.motivation ? 'bg-green-500' : 'bg-gray-200'}`} />
                ))}
              </div>
            </div>

            {/* Sleep */}
            <div className="flex items-center justify-between px-5 py-[9px] border-b border-[#faf9f7]">
              <div className="flex items-center gap-[9px] text-[12px] font-medium text-gray-500">
                <div className="w-6 h-6 rounded-[7px] bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 18a5 5 0 00-10 0" /><line x1="12" y1="2" x2="12" y2="9" /><line x1="4.22" y1="10.22" x2="5.64" y2="11.64" /><line x1="1" y1="18" x2="3" y2="18" /><line x1="21" y1="18" x2="23" y2="18" /><line x1="18.36" y1="11.64" x2="19.78" y2="10.22" /></svg>
                </div>
                Sleep
              </div>
              <div className={`tracking-[-0.3px] ${selectedLog?.sleep != null ? 'text-[13.5px] font-bold text-[#1C1612]' : 'text-[11.5px] text-gray-400'}`}>
                {selectedLog?.sleep != null ? SLEEP_LABELS[selectedLog.sleep - 1] : '—'}
              </div>
            </div>

            {/* Calories */}
            <div className="flex items-center justify-between px-5 py-[9px]">
              <div className="flex items-center gap-[9px] text-[12px] font-medium text-gray-500">
                <div className="w-6 h-6 rounded-[7px] bg-gray-100 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 010 8h-1" /><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" /><line x1="6" y1="1" x2="6" y2="4" /><line x1="10" y1="1" x2="10" y2="4" /><line x1="14" y1="1" x2="14" y2="4" /></svg>
                </div>
                Calories
              </div>
              <div className={`tracking-[-0.3px] ${selectedDayTotalKcal > 0 ? 'text-[13.5px] font-bold text-[#C4622A]' : 'text-[11.5px] text-gray-400'}`}>
                {selectedDayTotalKcal > 0 ? `${selectedDayTotalKcal.toLocaleString()} kcal` : '—'}
              </div>
            </div>
          </div>

          {/* Zone 4: Streak */}
          <div className="px-5 pt-4 pb-[22px] flex-1">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.8px] text-[#9B8575] mb-2.5">Streak</p>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="text-[38px] font-bold text-[#1C1612] leading-none tracking-[-2px]">{streak}</div>
              <div>
                <div className="text-[13px] font-bold text-[#1C1612]">day streak</div>
                <div className="text-[10.5px] text-gray-400 mt-0.5">Best: {bestStreak} days</div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {last14Days.map((d, i) => {
                const dKey = d.toDateString();
                const isToday = dKey === todayKey;
                const hasWorkout = workoutDaySet.has(dKey);
                return (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-[4px] ${
                      isToday
                        ? 'bg-[#1C1612] ring-2 ring-gray-400 ring-offset-1'
                        : hasWorkout
                          ? 'bg-[#1C1612]'
                          : 'bg-gray-200'
                    }`}
                  />
                );
              })}
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Last 14 days</p>
          </div>

        </div>
      </div>

      {editTarget && (
        <EditOverlay
          workout={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
