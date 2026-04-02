'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { label: 'Add Workout', href: '/workout' },
  { label: 'History', href: '/history' },
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
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function formatDuration(seconds: number) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return `${m} min`;
}

export default function HistoryPage() {
  const pathname = usePathname();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, ExerciseRow[]>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase
        .from('workouts')
        .select('id, name, created_at, duration, rpe')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setWorkouts(data ?? []);
      setLoading(false);
    });
  }, []);

  async function toggleWorkout(workoutId: string) {
    if (expanded === workoutId) {
      setExpanded(null);
      return;
    }
    setExpanded(workoutId);
    if (details[workoutId]) return;

    setDetailLoading(workoutId);
    const supabase = createClient();
    const { data } = await supabase
      .from('workout_exercises')
      .select(`
        id,
        exercise_order,
        exercises (id, name),
        workout_sets (set_number, weight, reps, notes)
      `)
      .eq('workout_id', workoutId)
      .order('exercise_order');

    setDetails(prev => ({ ...prev, [workoutId]: (data as unknown as ExerciseRow[]) ?? [] }));
    setDetailLoading(null);
  }

  // Group workouts by calendar date
  const grouped: { date: string; workouts: Workout[] }[] = [];
  for (const w of workouts) {
    const date = new Date(w.created_at).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) {
      last.workouts.push(w);
    } else {
      grouped.push({ date, workouts: [w] });
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-52 bg-white border-r border-gray-200 flex flex-col py-6 px-3 gap-1">
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

      {/* Main content */}
      <main className="flex-1 bg-gray-50 p-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">History</h1>
        <p className="text-sm text-gray-500 mb-8">Click a workout to see its details.</p>

        {loading && (
          <p className="text-sm text-gray-400">Loading workouts…</p>
        )}

        {!loading && workouts.length === 0 && (
          <p className="text-sm text-gray-400">No workouts logged yet.</p>
        )}

        <div className="flex flex-col gap-8">
          {grouped.map(group => (
            <div key={group.date}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {formatDate(group.workouts[0].created_at)}
              </p>
              <div className="flex flex-col gap-3">
                {group.workouts.map(w => {
                  const isOpen = expanded === w.id;
                  const isLoadingDetail = detailLoading === w.id;
                  const exerciseRows = details[w.id];

                  return (
                    <div
                      key={w.id}
                      className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden"
                    >
                      {/* Workout header — clickable */}
                      <button
                        onClick={() => toggleWorkout(w.id)}
                        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{w.name}</p>
                          <p className="text-xs text-gray-400 mt-0.5 flex gap-3">
                            {w.duration ? <span>{formatDuration(w.duration)}</span> : null}
                            {w.rpe != null ? <span>RPE {w.rpe}</span> : null}
                          </p>
                        </div>
                        <span className="text-gray-300 text-lg leading-none">
                          {isOpen ? '▲' : '▼'}
                        </span>
                      </button>

                      {/* Exercise detail panel */}
                      {isOpen && (
                        <div className="border-t border-gray-100 px-5 py-4 flex flex-col gap-5">
                          {isLoadingDetail && (
                            <p className="text-sm text-gray-400">Loading…</p>
                          )}
                          {!isLoadingDetail && exerciseRows?.length === 0 && (
                            <p className="text-sm text-gray-400">No exercises recorded.</p>
                          )}
                          {!isLoadingDetail && exerciseRows?.map((ex, i) => (
                            <div key={ex.id}>
                              <p className="text-sm font-semibold text-gray-800 mb-2">
                                {i + 1}. {ex.exercises.name}
                              </p>
                              <div className="flex flex-col gap-1">
                                {/* Column headers */}
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
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
