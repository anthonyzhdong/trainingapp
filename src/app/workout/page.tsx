'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

import { usePathname } from 'next/navigation';
import Link from 'next/dist/client/link';

interface ExerciseEntry {
  name: string;
  sets: { reps: number; weight: number }[];
}

const navItems = [
  { label: 'Add Workout', href: '/workout' },
  { label: 'History', href: '/history' },
];

const defaultSet = () => ({ reps: 0, weight: 0 });

export default function WorkoutForm() {
  const pathname = usePathname();
  const router = useRouter();
  const [workoutName, setWorkoutName] = useState('');
  const [duration, setDuration] = useState('');
  const [rpe, setRpe] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([
    { name: '', sets: [defaultSet()] },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addExercise = () => {
    setExercises(prev => [...prev, { name: '', sets: [defaultSet()] }]);
  };

  const updateExerciseName = (exIdx: number, name: string) => {
    setExercises(prev =>
      prev.map((ex, i) => (i === exIdx ? { ...ex, name } : ex))
    );
  };

  const addSet = (exIdx: number) => {
    setExercises(prev =>
      prev.map((ex, i) =>
        i === exIdx ? { ...ex, sets: [...ex.sets, defaultSet()] } : ex
      )
    );
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    setExercises(prev =>
      prev.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: ex.sets.filter((_, si) => si !== setIdx) }
          : ex
      )
    );
  };

  const updateSet = (
    exIdx: number,
    setIdx: number,
    field: 'reps' | 'weight',
    value: number
  ) => {
    setExercises(prev =>
      prev.map((ex, i) =>
        i === exIdx
          ? {
              ...ex,
              sets: ex.sets.map((s, si) =>
                si === setIdx ? { ...s, [field]: value } : s
              ),
            }
          : ex
      )
    );
  };

  const removeExercise = (exIdx: number) => {
    setExercises(prev => prev.filter((_, i) => i !== exIdx));
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in to save a workout.');
        return;
      }

      const { data: workout, error: workoutError } = await supabase
        .from('workouts')
        .insert({ name: workoutName, user_id: user.id, duration: duration ? parseInt(duration) * 60 : 0, rpe: rpe ? parseFloat(rpe) : null })
        .select('id')
        .single();

      if (workoutError || !workout) {
        setError(workoutError?.message ?? 'Failed to save workout.');
        return;
      }

      const sets = [];
      for (let exIdx = 0; exIdx < exercises.length; exIdx++) {
        const ex = exercises[exIdx];

        const { data: existing } = await supabase
          .from('exercises')
          .select('id')
          .eq('name', ex.name)
          .maybeSingle();

        let exerciseId: string;
        if (existing) {
          exerciseId = existing.id;
        } else {
          const { data: newEx, error: exError } = await supabase
            .from('exercises')
            .insert({ name: ex.name })
            .select('id')
            .single();
          if (exError || !newEx) {
            setError(exError?.message ?? 'Failed to save exercise.');
            return;
          }
          exerciseId = newEx.id;
        }

        const { data: workoutExercise, error: weError } = await supabase
          .from('workout_exercises')
          .insert({ workout_id: workout.id, exercise_id: exerciseId, exercise_order: exIdx + 1 })
          .select('id')
          .single();
        if (weError || !workoutExercise) {
          setError(weError?.message ?? 'Failed to save workout exercise.');
          return;
        }

        for (let i = 0; i < ex.sets.length; i++) {
          sets.push({
            workout_exercise_id: workoutExercise.id,
            set_number: i + 1,
            reps: ex.sets[i].reps,
            weight: ex.sets[i].weight,
          });
        }
      }

      const { error: setsError } = await supabase.from('workout_sets').insert(sets);
      if (setsError) {
        setError(setsError.message);
        return;
      }

      router.push('/dashboard');
    } finally {
      setSubmitting(false);
    }
  };

  return (


    
    <div className="min-h-screen bg-gray-50 px-4 py-10">
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
      <div className="max-w-xl mx-auto">
        
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Log Workout</h1>
        <p className="text-sm text-gray-500 mb-6">Add your exercises, sets, reps, and weight.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Workout name */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Workout name</label>
            <input
              type="text"
              value={workoutName}
              onChange={e => setWorkoutName(e.target.value)}
              placeholder="e.g. Push day"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Exercises */}
          {exercises.map((ex, exIdx) => (
            <div
              key={exIdx}
              className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4"
            >
              {/* Exercise header */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ex.name}
                  onChange={e => updateExerciseName(exIdx, e.target.value)}
                  placeholder="Exercise name"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                {exercises.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeExercise(exIdx)}
                    className="text-gray-400 hover:text-red-500 text-sm px-2 transition-colors"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Set rows */}
              <div className="flex flex-col gap-2">
                {/* Column headers */}
                <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 px-1">
                  <span className="text-xs text-gray-400 text-center">Set</span>
                  <span className="text-xs text-gray-400 text-center">Reps</span>
                  <span className="text-xs text-gray-400 text-center">Weight (kg)</span>
                  <span />
                </div>

                {ex.sets.map((s, setIdx) => (
                  <div
                    key={setIdx}
                    className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center"
                  >
                    <span className="text-sm text-gray-500 text-center">{setIdx + 1}</span>
                    <input
                      type="number"
                      min={0}
                      value={s.reps === 0 ? '' : s.reps}
                      onChange={e =>
                        updateSet(exIdx, setIdx, 'reps', Number(e.target.value))
                      }
                      placeholder="0"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    <input
                      type="number"
                      min={0}
                      step={0.5}
                      value={s.weight === 0 ? '' : s.weight}
                      onChange={e =>
                        updateSet(exIdx, setIdx, 'weight', Number(e.target.value))
                      }
                      placeholder="0"
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                    />
                    {ex.sets.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeSet(exIdx, setIdx)}
                        className="text-gray-300 hover:text-red-400 text-lg leading-none transition-colors"
                      >
                        ×
                      </button>
                    ) : (
                      <span />
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => addSet(exIdx)}
                className="self-start text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors"
              >
                + Add set
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={addExercise}
            className="border border-dashed border-gray-300 rounded-2xl py-3 text-sm text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
          >
            + Add exercise
          </button>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">RPE of session (1–10)</label>
            <input
              type="number"
              min={1}
              max={10}
              step={0.5}
              value={rpe}
              onChange={e => setRpe(e.target.value)}
              placeholder="e.g. 7"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 60"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save workout'}
          </button>
        </form>
      </div>
    </div>
  );
}
