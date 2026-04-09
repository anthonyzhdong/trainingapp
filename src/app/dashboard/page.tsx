'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import Sidebar from '@/components/Sidebar';
import {
  calculateWorkoutKcal,
  calculateRunningKcal,
  calculateCyclingKcal,
} from '@/lib/calories';

// ---- types (shared with history) ----

interface Workout {
  id: string;
  name: string;
  created_at: string;
  duration: number;
  rpe: number | null;
  session_type: 'lifting' | 'running' | 'cycling';
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

interface Profile {
  weight: number | null;
  first_name: string | null;
}

// ---- helpers ----

function getWeekMonday(): Date {
  const now = new Date();
  const dow = now.getDay();
  const toMonday = dow === 0 ? -6 : 1 - dow;
  const d = new Date(now);
  d.setDate(now.getDate() + toMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function getISOWeek(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
}

function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

function sessionTypeToDisplay(type: Workout['session_type']): 'strength' | 'cardio' {
  return type === 'lifting' ? 'strength' : 'cardio';
}

function workoutSubtitle(
  w: Workout,
  runningSessions: Record<string, RunningSession>,
  cyclingSessions: Record<string, CyclingSession>,
): string {
  if (w.session_type === 'running') {
    const rs = runningSessions[w.id];
    if (!rs) return w.duration ? formatDuration(w.duration) : '';
    return `${rs.distance % 1 === 0 ? rs.distance : rs.distance.toFixed(1)} km · ${rs.run_type}`;
  }
  if (w.session_type === 'cycling') {
    const cs = cyclingSessions[w.id];
    if (!cs) return w.duration ? formatDuration(w.duration) : '';
    return `${cs.distance % 1 === 0 ? cs.distance : cs.distance.toFixed(1)} km · ${cs.ride_type}`;
  }
  // lifting
  return w.duration ? formatDuration(w.duration) : '';
}

function calcStreak(allWorkouts: Workout[]): number {
  if (allWorkouts.length === 0) return 0;
  const days = new Set(allWorkouts.map(w => new Date(w.created_at).toDateString()));
  const today = new Date();
  let streak = 0;
  let cursor = new Date(today);
  cursor.setHours(0, 0, 0, 0);
  // If today has no workout yet, start counting from yesterday
  if (!days.has(today.toDateString())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (days.has(cursor.toDateString())) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function calcTodayKcal(
  todayWorkouts: Workout[],
  runningSessions: Record<string, RunningSession>,
  cyclingSessions: Record<string, CyclingSession>,
  profileWeight: number | null,
): number {
  let total = 0;
  for (const w of todayWorkouts) {
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

// ---- sub-components ----

function RatingButtons({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-full border text-sm font-medium transition-colors ${
            value === n
              ? 'bg-gray-900 text-white border-gray-900'
              : 'border-gray-300 text-gray-700 hover:border-gray-400'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

// ---- page ----

const DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

export default function Dashboard() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [allWorkouts, setAllWorkouts] = useState<Workout[]>([]);
  const [runningSessions, setRunningSessions] = useState<Record<string, RunningSession>>({});
  const [cyclingSessions, setCyclingSessions] = useState<Record<string, CyclingSession>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Today's log state
  const [weight, setWeight] = useState('');
  const [motivation, setMotivation] = useState(0);
  const [soreness, setSoreness] = useState(0);
  const [sleepQuality, setSleepQuality] = useState(0);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const monday = getWeekMonday();
      const weekEnd = addDays(monday, 7);

      const [{ data: weekData }, { data: historyData }, { data: profileData }] = await Promise.all([
        supabase
          .from('workouts')
          .select('id, name, created_at, duration, rpe, session_type')
          .eq('user_id', user.id)
          .gte('created_at', monday.toISOString())
          .lt('created_at', weekEnd.toISOString())
          .order('created_at', { ascending: true }),
        supabase
          .from('workouts')
          .select('id, created_at, session_type')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('profile')
          .select('weight, first_name')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const weekWorkouts: Workout[] = weekData ?? [];
      setWorkouts(weekWorkouts);
      setAllWorkouts((historyData as Workout[]) ?? []);
      setProfile(profileData ?? null);

      const runningIds = weekWorkouts.filter(w => w.session_type === 'running').map(w => w.id);
      const cyclingIds = weekWorkouts.filter(w => w.session_type === 'cycling').map(w => w.id);

      await Promise.all([
        runningIds.length > 0
          ? supabase.from('running_sessions')
              .select('workout_id, distance, run_type, elevation_gain')
              .in('workout_id', runningIds)
              .then(({ data }) => {
                const map: Record<string, RunningSession> = {};
                for (const r of data ?? []) map[r.workout_id] = r as RunningSession;
                setRunningSessions(map);
              })
          : Promise.resolve(),
        cyclingIds.length > 0
          ? supabase.from('cycling_sessions')
              .select('workout_id, distance, ride_type, elevation_gain, avg_power')
              .in('workout_id', cyclingIds)
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

  // Derived values
  const monday = getWeekMonday();
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const todayStr = new Date().toDateString();
  const weekNumber = getISOWeek(new Date());

  // Bin workouts by day index (Mon=0 … Sun=6)
  const byDay: Record<number, Workout[]> = {};
  for (const w of workouts) {
    const d = new Date(w.created_at);
    const dow = d.getDay();
    const idx = dow === 0 ? 6 : dow - 1;
    byDay[idx] = [...(byDay[idx] ?? []), w];
  }

  const todayIdx = (() => {
    const dow = new Date().getDay();
    return dow === 0 ? 6 : dow - 1;
  })();

  const todayWorkouts = byDay[todayIdx] ?? [];
  const streak = calcStreak(allWorkouts);
  const todayKcal = calcTodayKcal(todayWorkouts, runningSessions, cyclingSessions, profile?.weight ?? null);
  const workoutsThisWeek = workouts.length;

  const dayLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen flex">
      <Sidebar />

      <main className="flex-1 bg-[#f5f4f0] p-8 flex gap-6">
        {/* Left column */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-sm text-gray-500 mt-0.5">{dayLabel} · Week {weekNumber}</p>
            </div>
            <Link
              href="/workout"
              className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 transition-colors shadow-sm"
            >
              + Add workout ↗
            </Link>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">
                Est. Calories Today
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {todayKcal > 0 ? todayKcal.toLocaleString() : '—'}
                {todayKcal > 0 && <span className="text-base font-medium text-gray-500 ml-1">kcal</span>}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">
                Workouts This Week
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '—' : workoutsThisWeek}
              </p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-tight">
                Streak
              </p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {loading ? '—' : streak}
                {!loading && <span className="text-base font-medium text-gray-500 ml-1">days</span>}
              </p>
            </div>
          </div>

          {/* Week at a glance */}
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex-1">
            <h2 className="text-sm font-semibold text-gray-800 mb-3">Week at a glance</h2>

            {/* Legend */}
            <div className="flex gap-4 mb-4">
              {[
                { label: 'Strength', color: 'bg-blue-500' },
                { label: 'Cardio', color: 'bg-green-500' },
                { label: 'Rest', color: 'bg-gray-300' },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${item.color}`} />
                  <span className="text-xs text-gray-500">{item.label}</span>
                </div>
              ))}
            </div>

            {loading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : (
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, i) => {
                  const isToday = day.toDateString() === todayStr;
                  const dayWorkouts = byDay[i] ?? [];
                  const firstWorkout = dayWorkouts[0] ?? null;
                  const displayType = firstWorkout ? sessionTypeToDisplay(firstWorkout.session_type) : null;

                  const cardColorClass = displayType === 'strength'
                    ? 'bg-blue-100 text-blue-800'
                    : displayType === 'cardio'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-500';

                  return (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase">{DAY_LABELS[i]}</p>
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                          isToday ? 'bg-gray-900 text-white' : 'text-gray-700'
                        }`}
                      >
                        {day.getDate()}
                      </div>

                      {firstWorkout && (
                        <div className={`w-full rounded-xl px-2 py-2 text-center text-xs font-medium leading-tight ${cardColorClass}`}>
                          <p className="font-semibold truncate">{firstWorkout.name}</p>
                          <p className="text-[10px] mt-0.5 opacity-80 truncate">
                            {workoutSubtitle(firstWorkout, runningSessions, cyclingSessions)}
                          </p>
                        </div>
                      )}

                      {(isToday || (!firstWorkout && !isToday)) && (
                        <Link
                          href="/workout"
                          className="w-full rounded-xl border border-dashed border-gray-300 py-2 flex flex-col items-center justify-center text-[10px] text-gray-400 hover:border-gray-400 hover:text-gray-600 transition-colors"
                        >
                          + add ↗
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel — Today's log */}
        <div className="w-64 bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-5 self-start">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800">Today's log</h2>
            <button className="text-gray-400 hover:text-gray-600 text-lg leading-none">···</button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-gray-600">Weight (kg)</label>
            <input
              type="number"
              placeholder="e.g. 82.5"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-600">Motivation —</p>
            <RatingButtons value={motivation} onChange={setMotivation} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-600">Soreness —</p>
            <RatingButtons value={soreness} onChange={setSoreness} />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-gray-600">Sleep quality —</p>
            <RatingButtons value={sleepQuality} onChange={setSleepQuality} />
          </div>

          <button className="w-full bg-gray-900 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-gray-800 transition-colors mt-1">
            Save log
          </button>
        </div>
      </main>
    </div>
  );
}
