'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  calculateBMR,
  calculateWorkoutKcal,
  calculateRunningKcal,
  calculateTDEE,
  ACTIVITY_LABELS,
  ACTIVITY_MULTIPLIERS,
} from '@/lib/calories';

const navItems = [
  { label: 'Add Workout', href: '/workout' },
  { label: 'History', href: '/history' },
  { label: 'Profile', href: '/profile' },
];

interface SetRow {
  set_number: number;
  weight: number;
  reps: number;
  notes: string | null;
}

interface ExerciseRow {
  id: string;
  exercise_order: number;
  exercises: { id: string; name: string };
  workout_sets: SetRow[];
}

interface Workout {
  id: string;
  name: string;
  created_at: string;
  duration: number;
  rpe: number | null;
  session_type: 'lifting' | 'running';
}

interface RunningSession {
  id: string;
  workout_id: string;
  distance: number;
  unit_preference: 'km' | 'mi';
  avg_pace: number | null;
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_cadence: number | null;
  elevation_gain: number | null;
  elevation_loss: number | null;
  run_type: string;
  rpe: number | null;
  notes: string | null;
}

interface Profile {
  weight: number | null;
  height: number | null;
  age: number | null;
  sex: string | null;
  activity_level: string | null;
}

// Calendar constants
const START_HOUR = 5;
const END_HOUR = 23;
const HOUR_PX = 60;
const GRID_HEIGHT = (END_HOUR - START_HOUR) * HOUR_PX;
const TIME_COL = 52;
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// --- helpers ---

function getWeekMonday(offset: number): Date {
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

function topPx(iso: string): number {
  const d = new Date(iso);
  const h = d.getHours() + d.getMinutes() / 60;
  const clamped = Math.max(START_HOUR, Math.min(END_HOUR - 0.5, h));
  return (clamped - START_HOUR) * HOUR_PX;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function weekRangeLabel(monday: Date): string {
  const sunday = addDays(monday, 6);
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)}, ${sunday.getFullYear()}`;
}

function formatDuration(seconds: number) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function formatPace(secondsPerUnit: number, unit: 'km' | 'mi'): string {
  const mins = Math.floor(secondsPerUnit / 60);
  const secs = Math.round(secondsPerUnit % 60);
  return `${mins}:${String(secs).padStart(2, '0')} /${unit}`;
}

function formatDistance(distance: number, unit: 'km' | 'mi'): string {
  return `${distance % 1 === 0 ? distance : distance.toFixed(2)} ${unit}`;
}

// Convert stored distance to km for calorie calculation
function toKm(distance: number, unit: 'km' | 'mi'): number {
  return unit === 'mi' ? distance * 1.60934 : distance;
}

// --- component ---

export default function HistoryPage() {
  const pathname = usePathname();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [runningSessions, setRunningSessions] = useState<Record<string, RunningSession>>({});
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ExerciseRow[]>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedDayIdx, setSelectedDayIdx] = useState<number | null>(null);

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
          .select('weight, height, age, sex, activity_level')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const allWorkouts: Workout[] = workoutData ?? [];
      setWorkouts(allWorkouts);
      setProfile(profileData ?? null);

      // Fetch running sessions for all running workouts
      const runningIds = allWorkouts
        .filter(w => w.session_type === 'running')
        .map(w => w.id);

      if (runningIds.length > 0) {
        const { data: runData } = await supabase
          .from('running_sessions')
          .select('*')
          .in('workout_id', runningIds);

        const map: Record<string, RunningSession> = {};
        for (const r of runData ?? []) {
          map[r.workout_id] = r as RunningSession;
        }
        setRunningSessions(map);
      }

      setLoading(false);
    });
  }, []);

  async function selectWorkout(id: string) {
    if (selectedId === id) { setSelectedId(null); return; }
    setSelectedId(id);

    const workout = workouts.find(w => w.id === id);
    // Running details are already loaded; only lazy-fetch for lifting
    if (!workout || workout.session_type === 'running') return;
    if (details[id]) return;

    setDetailLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('workout_exercises')
      .select(`id, exercise_order, exercises (id, name), workout_sets (set_number, weight, reps, notes)`)
      .eq('workout_id', id)
      .order('exercise_order');

    setDetails(prev => ({ ...prev, [id]: (data as unknown as ExerciseRow[]) ?? [] }));
    setDetailLoading(false);
  }

  const monday = getWeekMonday(weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const weekEnd = addDays(monday, 7);

  const byDay: Record<number, Workout[]> = {};
  for (const w of workouts) {
    const d = new Date(w.created_at);
    if (d < monday || d >= weekEnd) continue;
    const dow = d.getDay();
    const idx = dow === 0 ? 6 : dow - 1;
    byDay[idx] = [...(byDay[idx] ?? []), w];
  }

  const todayStr = new Date().toDateString();
  const selectedWorkout = selectedId ? workouts.find(w => w.id === selectedId) ?? null : null;
  const selectedExercises = selectedId ? details[selectedId] : undefined;
  const selectedRunning = selectedId ? runningSessions[selectedId] : undefined;

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  // Calorie calculation that handles mixed session types
  function calcDayKcal(dayWorkouts: Workout[], profileWeight: number | null): number {
    let total = 0;
    for (const w of dayWorkouts) {
      if (w.session_type === 'running') {
        const rs = runningSessions[w.id];
        if (rs && profileWeight) {
          const km = toKm(rs.distance, rs.unit_preference);
          total += calculateRunningKcal(km, profileWeight, rs.elevation_gain ?? 0);
        } else if (w.rpe != null) {
          // Fallback to RPE-based if running session data not loaded yet
          total += calculateWorkoutKcal([{ duration: w.duration, rpe: w.rpe }]);
        }
      } else {
        total += calculateWorkoutKcal([{ duration: w.duration, rpe: w.rpe }]);
      }
    }
    return total;
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-gray-200 flex flex-col py-6 px-3 gap-1 flex-shrink-0">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-3">Menu</p>
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              pathname === item.href
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1 bg-gray-50 p-8 flex flex-col min-w-0">

        {/* Header row */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 leading-tight">History</h1>
            <p className="text-sm text-gray-500 mt-0.5">{weekRangeLabel(monday)}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setWeekOffset(o => o - 1); setSelectedDayIdx(null); }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => { setWeekOffset(0); setSelectedDayIdx(null); }}
              disabled={weekOffset === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              This week
            </button>
            <button
              onClick={() => { setWeekOffset(o => o + 1); setSelectedDayIdx(null); }}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>

        {/* TDEE card */}
        {(() => {
          const p = profile;
          const profileComplete =
            p && p.weight != null && p.height != null && p.age != null && p.sex && p.activity_level;

          if (!profileComplete) {
            return (
              <div className="mb-5 bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-3">
                <p className="text-sm text-gray-400">
                  <Link href="/profile" className="underline text-gray-600 hover:text-gray-900">
                    Complete your profile
                  </Link>{' '}
                  to see your daily calorie estimate.
                </p>
              </div>
            );
          }

          const bmr = calculateBMR(p.weight!, p.height!, p.age!, p.sex!);
          const multiplier = ACTIVITY_MULTIPLIERS[p.activity_level!];
          const activityLabel = ACTIVITY_LABELS[p.activity_level!];

          let workoutKcal: number;
          let workoutLabel: string;
          let cardTitle: string;

          if (selectedDayIdx !== null) {
            const dayWorkouts = byDay[selectedDayIdx] ?? [];
            workoutKcal = calcDayKcal(dayWorkouts, p.weight);
            workoutLabel = `+${workoutKcal} kcal`;
            cardTitle = `${DAY_LABELS[selectedDayIdx]} — Calorie Estimate`;
          } else {
            const allWeekWorkouts = Object.values(byDay).flat();
            workoutKcal = Math.round(calcDayKcal(allWeekWorkouts, p.weight) / 7);
            workoutLabel = `+${workoutKcal} kcal/day avg`;
            cardTitle = 'Weekly Average — Daily Calorie Estimate';
          }

          const tdee = calculateTDEE(bmr, p.activity_level!, workoutKcal);

          return (
            <div className="mb-5 bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{cardTitle}</p>
                {selectedDayIdx !== null && (
                  <button
                    onClick={() => setSelectedDayIdx(null)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Show weekly avg
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">BMR</p>
                  <p className="text-sm font-semibold text-gray-900">{bmr.toLocaleString()} kcal</p>
                </div>
                <span className="text-gray-300 text-sm">×</span>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Lifestyle ({multiplier})</p>
                  <p className="text-sm font-semibold text-gray-900">{activityLabel}</p>
                </div>
                {workoutKcal > 0 && (
                  <>
                    <span className="text-gray-300 text-sm">+</span>
                    <div>
                      <p className="text-xs text-gray-400 mb-0.5">{selectedDayIdx !== null ? 'Session' : 'Sessions this week'}</p>
                      <p className="text-sm font-semibold text-gray-900">{workoutLabel}</p>
                    </div>
                  </>
                )}
                <span className="text-gray-300 text-sm">=</span>
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Daily target</p>
                  <p className="text-base font-bold text-gray-900">{tdee.toLocaleString()} kcal</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Calendar card */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">

          {/* Day header */}
          <div className="flex border-b border-gray-200 flex-shrink-0">
            <div style={{ width: TIME_COL }} className="flex-shrink-0" />
            {weekDays.map((day, i) => {
              const isToday = day.toDateString() === todayStr;
              const isSelected = selectedDayIdx === i;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDayIdx(isSelected ? null : i)}
                  className={`flex-1 text-center py-3 border-l border-gray-100 transition-colors ${
                    isSelected ? 'bg-gray-900' : isToday ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <p className={`text-xs font-semibold uppercase tracking-wide ${
                    isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-gray-400'
                  }`}>
                    {DAY_LABELS[i]}
                  </p>
                  <p className={`text-lg font-semibold mt-0.5 leading-none ${
                    isSelected ? 'text-white' : isToday ? 'text-blue-600' : 'text-gray-800'
                  }`}>
                    {day.getDate()}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <div className="flex overflow-y-auto flex-1" style={{ maxHeight: 'calc(100vh - 260px)' }}>

            {/* Time labels */}
            <div
              className="flex-shrink-0 relative select-none"
              style={{ width: TIME_COL, height: GRID_HEIGHT }}
            >
              {hours.map(h => (
                <div
                  key={h}
                  className="absolute right-2 text-xs text-gray-400 leading-none"
                  style={{ top: (h - START_HOUR) * HOUR_PX - 6 }}
                >
                  {String(h).padStart(2, '0')}:00
                </div>
              ))}
            </div>

            {/* Day columns */}
            {weekDays.map((day, dayIdx) => {
              const isToday = day.toDateString() === todayStr;
              const dayWorkouts = byDay[dayIdx] ?? [];

              return (
                <div
                  key={dayIdx}
                  className={`flex-1 border-l border-gray-100 relative ${isToday ? 'bg-blue-50/30' : ''}`}
                  style={{ height: GRID_HEIGHT, minWidth: 0 }}
                >
                  {hours.map(h => (
                    <div
                      key={h}
                      className="absolute w-full border-t border-gray-100"
                      style={{ top: (h - START_HOUR) * HOUR_PX }}
                    />
                  ))}
                  {hours.map(h => (
                    <div
                      key={`${h}h`}
                      className="absolute w-full border-t border-gray-50"
                      style={{ top: (h - START_HOUR) * HOUR_PX + HOUR_PX / 2 }}
                    />
                  ))}

                  {dayWorkouts.map((w, wi) => {
                    const isSelected = selectedId === w.id;
                    const isRunning = w.session_type === 'running';
                    const offset = wi * 3;
                    const rs = isRunning ? runningSessions[w.id] : null;

                    const baseColor = isRunning
                      ? isSelected ? 'bg-gray-900 border-gray-900' : 'bg-emerald-500 border-emerald-500 hover:bg-emerald-600 hover:border-emerald-600'
                      : isSelected ? 'bg-gray-900 border-gray-900' : 'bg-indigo-500 border-indigo-500 hover:bg-indigo-600 hover:border-indigo-600';

                    return (
                      <button
                        key={w.id}
                        onClick={() => selectWorkout(w.id)}
                        style={{ top: topPx(w.created_at) + offset, left: 4, right: 4, minHeight: 44 }}
                        className={`absolute rounded-xl px-2.5 py-2 text-left text-xs shadow-sm transition-all border text-white ${baseColor}`}
                      >
                        <p className="font-semibold leading-tight truncate">{w.name}</p>
                        <p className="opacity-75 mt-0.5">{timeLabel(w.created_at)}</p>
                        {rs ? (
                          <p className="opacity-75">{formatDistance(rs.distance, rs.unit_preference)}</p>
                        ) : w.duration ? (
                          <p className="opacity-75">{formatDuration(w.duration)}</p>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Loading / empty state */}
        {loading && <p className="text-sm text-gray-400 mt-4">Loading sessions…</p>}
        {!loading && workouts.length === 0 && (
          <p className="text-sm text-gray-400 mt-4">No sessions logged yet.</p>
        )}
        {!loading && workouts.length > 0 && Object.keys(byDay).length === 0 && (
          <p className="text-sm text-gray-400 mt-4">No sessions this week.</p>
        )}

        {/* Detail panel */}
        {selectedWorkout && (
          <div className="mt-5 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-gray-900">{selectedWorkout.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    selectedWorkout.session_type === 'running'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-indigo-100 text-indigo-700'
                  }`}>
                    {selectedWorkout.session_type}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 flex gap-3">
                  <span>{timeLabel(selectedWorkout.created_at)}</span>
                  {selectedWorkout.duration ? <span>{formatDuration(selectedWorkout.duration)}</span> : null}
                  {selectedWorkout.rpe != null ? <span>RPE {selectedWorkout.rpe}</span> : null}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-gray-300 hover:text-gray-500 text-lg leading-none transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4">
              {/* Running detail */}
              {selectedWorkout.session_type === 'running' && selectedRunning && (
                <div className="flex flex-col gap-4">
                  {/* Stats grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <p className="text-xs text-gray-400 mb-0.5">Distance</p>
                      <p className="text-sm font-semibold text-gray-900">
                        {formatDistance(selectedRunning.distance, selectedRunning.unit_preference)}
                      </p>
                    </div>
                    {selectedRunning.avg_pace && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Avg pace</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatPace(selectedRunning.avg_pace, selectedRunning.unit_preference)}
                        </p>
                      </div>
                    )}
                    <div className="bg-gray-50 rounded-xl px-4 py-3">
                      <p className="text-xs text-gray-400 mb-0.5">Type</p>
                      <p className="text-sm font-semibold text-gray-900 capitalize">{selectedRunning.run_type}</p>
                    </div>
                    {selectedRunning.avg_heart_rate && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Avg HR</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedRunning.avg_heart_rate} bpm</p>
                      </div>
                    )}
                    {selectedRunning.max_heart_rate && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Max HR</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedRunning.max_heart_rate} bpm</p>
                      </div>
                    )}
                    {selectedRunning.avg_cadence && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Cadence</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedRunning.avg_cadence} spm</p>
                      </div>
                    )}
                    {selectedRunning.elevation_gain != null && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Elev gain</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedRunning.elevation_gain} m</p>
                      </div>
                    )}
                    {selectedRunning.elevation_loss != null && (
                      <div className="bg-gray-50 rounded-xl px-4 py-3">
                        <p className="text-xs text-gray-400 mb-0.5">Elev loss</p>
                        <p className="text-sm font-semibold text-gray-900">{selectedRunning.elevation_loss} m</p>
                      </div>
                    )}
                  </div>
                  {selectedRunning.notes && (
                    <p className="text-sm text-gray-600 italic">{selectedRunning.notes}</p>
                  )}
                </div>
              )}

              {/* Lifting detail */}
              {selectedWorkout.session_type === 'lifting' && (
                <>
                  {detailLoading && <p className="text-sm text-gray-400">Loading…</p>}
                  {!detailLoading && selectedExercises?.length === 0 && (
                    <p className="text-sm text-gray-400">No exercises recorded.</p>
                  )}
                  <div className="flex flex-col gap-5">
                    {!detailLoading && selectedExercises?.map((ex, i) => (
                      <div key={ex.id}>
                        <p className="text-sm font-semibold text-gray-800 mb-2">
                          {i + 1}. {ex.exercises.name}
                        </p>
                        <div className="flex flex-col gap-1">
                          <div className="grid grid-cols-[2rem_1fr_1fr] gap-2 px-1 mb-1">
                            <span className="text-xs text-gray-400 text-center">Set</span>
                            <span className="text-xs text-gray-400 text-center">Reps</span>
                            <span className="text-xs text-gray-400 text-center">Weight (kg)</span>
                          </div>
                          {ex.workout_sets
                            .slice()
                            .sort((a, b) => a.set_number - b.set_number)
                            .map(s => (
                              <div
                                key={s.set_number}
                                className="grid grid-cols-[2rem_1fr_1fr] gap-2 items-center bg-gray-50 rounded-lg px-2 py-1.5"
                              >
                                <span className="text-sm text-gray-500 text-center">{s.set_number}</span>
                                <span className="text-sm text-gray-900 text-center">{s.reps}</span>
                                <span className="text-sm text-gray-900 text-center">{s.weight}</span>
                              </div>
                            ))}
                          {ex.workout_sets.some(s => s.notes) && (
                            <p className="text-xs text-gray-400 mt-1 px-1">
                              {ex.workout_sets.find(s => s.notes)?.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
