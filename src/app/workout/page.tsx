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
  { label: 'Profile', href: '/profile' },
];

const defaultSet = () => ({ reps: 0, weight: 0 });

const RUN_TYPES = ['easy', 'tempo', 'interval', 'long', 'race'] as const;

export default function WorkoutForm() {
  const pathname = usePathname();
  const router = useRouter();

  // --- shared state ---
  const [sessionType, setSessionType] = useState<'lifting' | 'running'>('lifting');
  const [workoutName, setWorkoutName] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // --- lifting state ---
  const [rpe, setRpe] = useState('');
  const [exercises, setExercises] = useState<ExerciseEntry[]>([
    { name: '', sets: [defaultSet()] },
  ]);

  // --- running state ---
  const [runDistance, setRunDistance] = useState('');
  const [runUnit, setRunUnit] = useState<'km' | 'mi'>('km');
  const [runType, setRunType] = useState<string>('easy');
  const [runAvgHR, setRunAvgHR] = useState('');
  const [runMaxHR, setRunMaxHR] = useState('');
  const [runCadence, setRunCadence] = useState('');
  const [runElevGain, setRunElevGain] = useState('');
  const [runElevLoss, setRunElevLoss] = useState('');
  const [runRpe, setRunRpe] = useState('');
  const [runNotes, setRunNotes] = useState('');

  // --- lifting helpers ---
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

  // --- submit ---
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

      const durationSeconds = duration ? parseInt(duration) * 60 : 0;

      if (sessionType === 'running') {
        if (!runDistance || parseFloat(runDistance) <= 0) {
          setError('Please enter a valid distance.');
          return;
        }

        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert({
            name: workoutName || `${runType.charAt(0).toUpperCase() + runType.slice(1)} run`,
            user_id: user.id,
            duration: durationSeconds,
            rpe: runRpe ? parseFloat(runRpe) : null,
            session_type: 'running',
          })
          .select('id')
          .single();

        if (workoutError || !workout) {
          setError(workoutError?.message ?? 'Failed to save workout.');
          return;
        }

        const distanceNum = parseFloat(runDistance);
        const avgPace = durationSeconds > 0 && distanceNum > 0
          ? Math.round(durationSeconds / distanceNum)
          : null;

        const { error: runError } = await supabase
          .from('running_sessions')
          .insert({
            workout_id: workout.id,
            distance: distanceNum,
            unit_preference: runUnit,
            avg_pace: avgPace,
            avg_heart_rate: runAvgHR ? parseInt(runAvgHR) : null,
            max_heart_rate: runMaxHR ? parseInt(runMaxHR) : null,
            avg_cadence: runCadence ? parseInt(runCadence) : null,
            elevation_gain: runElevGain ? parseFloat(runElevGain) : null,
            elevation_loss: runElevLoss ? parseFloat(runElevLoss) : null,
            run_type: runType,
            rpe: runRpe ? parseFloat(runRpe) : null,
            notes: runNotes || null,
          });

        if (runError) {
          setError(runError.message);
          return;
        }
      } else {
        // lifting
        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert({
            name: workoutName,
            user_id: user.id,
            duration: durationSeconds,
            rpe: rpe ? parseFloat(rpe) : null,
            session_type: 'lifting',
          })
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
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Log Session</h1>
        <p className="text-sm text-gray-500 mb-6">Track your lifting or running session.</p>

        {/* Session type toggle */}
        <div className="flex mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setSessionType('lifting')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              sessionType === 'lifting'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Lifting
          </button>
          <button
            type="button"
            onClick={() => setSessionType('running')}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              sessionType === 'running'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Running
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">

          {/* Workout name (shared) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">
              {sessionType === 'running' ? 'Session name (optional)' : 'Workout name'}
            </label>
            <input
              type="text"
              value={workoutName}
              onChange={e => setWorkoutName(e.target.value)}
              placeholder={sessionType === 'running' ? 'e.g. Morning easy run' : 'e.g. Push day'}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* Duration (shared) */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Duration (minutes)</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 45"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>

          {/* ---- LIFTING FORM ---- */}
          {sessionType === 'lifting' && (
            <>
              {exercises.map((ex, exIdx) => (
                <div
                  key={exIdx}
                  className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4"
                >
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

                  <div className="flex flex-col gap-2">
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
                          onChange={e => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))}
                          placeholder="0"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-900"
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={s.weight === 0 ? '' : s.weight}
                          onChange={e => updateSet(exIdx, setIdx, 'weight', Number(e.target.value))}
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
            </>
          )}

          {/* ---- RUNNING FORM ---- */}
          {sessionType === 'running' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm flex flex-col gap-5">

              {/* Distance + unit */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Distance</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={runDistance}
                    onChange={e => setRunDistance(e.target.value)}
                    placeholder="0.00"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <div className="flex bg-gray-100 rounded-lg p-1">
                    <button
                      type="button"
                      onClick={() => setRunUnit('km')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        runUnit === 'km' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      km
                    </button>
                    <button
                      type="button"
                      onClick={() => setRunUnit('mi')}
                      className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                        runUnit === 'mi' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      mi
                    </button>
                  </div>
                </div>
              </div>

              {/* Run type */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Run type</label>
                <div className="flex flex-wrap gap-2">
                  {RUN_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRunType(t)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors border ${
                        runType === t
                          ? 'bg-gray-900 border-gray-900 text-white'
                          : 'border-gray-300 text-gray-600 hover:border-gray-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Heart rate row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Avg heart rate (bpm)</label>
                  <input
                    type="number"
                    min={0}
                    value={runAvgHR}
                    onChange={e => setRunAvgHR(e.target.value)}
                    placeholder="e.g. 148"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Max heart rate (bpm)</label>
                  <input
                    type="number"
                    min={0}
                    value={runMaxHR}
                    onChange={e => setRunMaxHR(e.target.value)}
                    placeholder="e.g. 172"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Cadence + elevation row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Avg cadence (spm)</label>
                  <input
                    type="number"
                    min={0}
                    value={runCadence}
                    onChange={e => setRunCadence(e.target.value)}
                    placeholder="e.g. 170"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700">Elevation gain (m)</label>
                  <input
                    type="number"
                    min={0}
                    value={runElevGain}
                    onChange={e => setRunElevGain(e.target.value)}
                    placeholder="e.g. 120"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
              </div>

              {/* Elevation loss */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Elevation loss (m)</label>
                <input
                  type="number"
                  min={0}
                  value={runElevLoss}
                  onChange={e => setRunElevLoss(e.target.value)}
                  placeholder="e.g. 95"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* RPE */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">RPE (1–10)</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  step={0.5}
                  value={runRpe}
                  onChange={e => setRunRpe(e.target.value)}
                  placeholder="e.g. 6"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Notes</label>
                <textarea
                  value={runNotes}
                  onChange={e => setRunNotes(e.target.value)}
                  rows={2}
                  placeholder="How did it feel?"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving...' : 'Save session'}
          </button>
        </form>
      </div>
    </div>
  );
}
