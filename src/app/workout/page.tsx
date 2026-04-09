'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

import { usePathname } from 'next/navigation';
import Link from 'next/dist/client/link';
import Sidebar from '@/components/Sidebar';

interface ExerciseEntry {
  name: string;
  sets: { reps: number; weight: number }[];
}

const defaultSet = () => ({ reps: 0, weight: 0 });

const RUN_TYPES = ['easy', 'tempo', 'interval', 'long', 'race'] as const;
const CYCLE_TYPES = ['easy', 'endurance', 'tempo', 'interval', 'climb', 'race'] as const;
const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

// ─── Stone design tokens ────────────────────────────────────────────────────
// bg page:      #FAF7F2
// bg card:      #FFFFFF   border: #EDE5DB
// bg input:     #FAF7F2   border: #EDE5DB  focus-border: #C4622A
// text primary: #1C1612
// text muted:   #9B8575
// text hint:    #CCC1B5
// accent:       #C4622A
// accent-light: #FDF1EA   accent-border: #ECD5C5
// cta bg:       #1C1612
// ────────────────────────────────────────────────────────────────────────────

function computePace(distance: string, duration: string, unit: 'km' | 'mi'): string | null {
  const d = parseFloat(distance);
  const dur = parseFloat(duration);
  if (!d || !dur || d <= 0 || dur <= 0) return null;
  const paceMin = dur / d;
  const mins = Math.floor(paceMin);
  const secs = Math.round((paceMin - mins) * 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs} /${unit}`;
}

function computeSpeed(distance: string, duration: string, unit: 'km' | 'mi'): string | null {
  const d = parseFloat(distance);
  const dur = parseFloat(duration);
  if (!d || !dur || d <= 0 || dur <= 0) return null;
  const speed = d / (dur / 60);
  return `${speed.toFixed(1)} ${unit}/h`;
}

export default function WorkoutForm() {
  const pathname = usePathname();
  const router = useRouter();

  // --- shared state ---
  const [sessionType, setSessionType] = useState<'lifting' | 'running' | 'cycling'>('lifting');
  const [workoutName, setWorkoutName] = useState('');
  const [duration, setDuration] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sessionRPE, setSessionRPE] = useState('');

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
  const [runElevGain, setRunElevGain] = useState('');
  const [runNotes, setRunNotes] = useState('');

  // --- cycling state ---
  const [cycleDistance, setCycleDistance] = useState('');
  const [cycleUnit, setCycleUnit] = useState<'km' | 'mi'>('km');
  const [cycleType, setCycleType] = useState<string>('easy');
  const [cycleAvgPower, setCycleAvgPower] = useState('');
  const [cycleAvgHR, setCycleAvgHR] = useState('');
  const [cycleMaxHR, setCycleMaxHR] = useState('');
  const [cycleCadence, setCycleCadence] = useState('');
  const [cycleElevGain, setCycleElevGain] = useState('');
  const [cycleRpe, setCycleRpe] = useState('');
  const [cycleNotes, setCycleNotes] = useState('');

  const [workoutDate, setWorkoutDate] = useState<string>(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  });

  // --- computed stats ---
  const runPace = useMemo(
    () => computePace(runDistance, duration, runUnit),
    [runDistance, duration, runUnit]
  );
  const cycleSpeed = useMemo(
    () => computeSpeed(cycleDistance, duration, cycleUnit),
    [cycleDistance, duration, cycleUnit]
  );

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
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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

      if (sessionType === 'cycling') {
        if (!cycleDistance || parseFloat(cycleDistance) <= 0) {
          setError('Please enter a valid distance.');
          return;
        }

        const { data: workout, error: workoutError } = await supabase
          .from('workouts')
          .insert({
            name: workoutName || `${cycleType.charAt(0).toUpperCase() + cycleType.slice(1)} ride`,
            user_id: user.id,
            duration: durationSeconds,
            rpe: cycleRpe ? parseFloat(cycleRpe) : null,
            session_type: 'cycling',
            created_at: new Date(workoutDate).toISOString(),
          })
          .select('id')
          .single();

        if (workoutError || !workout) {
          setError(workoutError?.message ?? 'Failed to save workout.');
          return;
        }

        const distanceNum = parseFloat(cycleDistance);
        const distanceKm = cycleUnit === 'mi' ? distanceNum * 1.60934 : distanceNum;
        const avgSpeed = durationSeconds > 0 && distanceKm > 0
          ? parseFloat((distanceKm / (durationSeconds / 3600)).toFixed(1))
          : null;

        const { error: cycleError } = await supabase
          .from('cycling_sessions')
          .insert({
            workout_id: workout.id,
            distance: distanceKm,
            avg_speed: avgSpeed,
            avg_power: cycleAvgPower ? parseInt(cycleAvgPower) : null,
            avg_heart_rate: cycleAvgHR ? parseInt(cycleAvgHR) : null,
            max_heart_rate: cycleMaxHR ? parseInt(cycleMaxHR) : null,
            avg_cadence: cycleCadence ? parseInt(cycleCadence) : null,
            elevation_gain: cycleElevGain ? parseFloat(cycleElevGain) : null,
            ride_type: cycleType,
            notes: cycleNotes || null,
          });

        if (cycleError) {
          setError(cycleError.message);
          return;
        }
      } else if (sessionType === 'running') {
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
            rpe: sessionRPE ? parseFloat(sessionRPE) : null,
            session_type: 'running',
            created_at: new Date(workoutDate).toISOString()
          })
          .select('id')
          .single();

        if (workoutError || !workout) {
          setError(workoutError?.message ?? 'Failed to save workout.');
          return;
        }

        const distanceNum = parseFloat(runDistance);
        const distanceKm = runUnit === 'mi' ? distanceNum * 1.60934 : distanceNum;
        const avgPace = durationSeconds > 0 && distanceKm > 0
          ? Math.round(durationSeconds / distanceKm)
          : null;

        const { error: runError } = await supabase
          .from('running_sessions')
          .insert({
            workout_id: workout.id,
            distance: distanceKm,
            avg_pace: avgPace,
            avg_heart_rate: runAvgHR ? parseInt(runAvgHR) : null,
            max_heart_rate: runMaxHR ? parseInt(runMaxHR) : null,
            elevation_gain: runElevGain ? parseFloat(runElevGain) : null,
            run_type: runType,
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

  // ─── Shared class helpers ──────────────────────────────────────────────────
  const inputCls =
    'w-full bg-[#FAF7F2] border border-[#EDE5DB] rounded-xl px-3.5 py-2.5 text-sm text-[#1C1612] placeholder-[#CCC1B5] focus:outline-none focus:border-[#C4622A] focus:bg-white transition-colors';

  const sectionLabelCls =
    'text-[10px] font-semibold uppercase tracking-widest text-[#9B8575]';

  const fieldLabelCls = 'text-xs font-semibold text-[#9B8575] tracking-wide';

  const cardCls =
    'bg-white border border-[#EDE5DB] rounded-2xl p-5 flex flex-col gap-4';

  return (
    <div className="min-h-screen bg-[#FAF7F2] px-4 py-4">
      <Sidebar />

      <div className="max-w-xl mx-auto">

        {/* ── Page header ── */}
        <div className="mb-1">
          <p className={`${sectionLabelCls} mb-1`}>Training log</p>
          <h1 className="text-[34px] font-bold text-[#1C1612] leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
            Log your session
          </h1>
          <p className="text-sm text-[#9B8575] italic mt-1">
            Track your lifting, running, or cycling session.
          </p>
        </div>

        {/* ── Session type tabs ── */}
        <div className="flex border-b border-[#EDE5DB] mt-7 mb-6">
          {(['lifting', 'running', 'cycling'] as const).map(type => (
            <button
              key={type}
              type="button"
              onClick={() => setSessionType(type)}
              className={`flex-1 pb-3 text-sm font-semibold capitalize transition-colors border-b-2 -mb-px ${
                sessionType === type
                  ? 'text-[#1C1612] border-[#C4622A]'
                  : 'text-[#9B8575] border-transparent hover:text-[#1C1612]'
              }`}
            >
              {type}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">

          {/* ── Shared: session name ── */}
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabelCls}>
              {sessionType === 'lifting' ? 'Workout name' : 'Session name'}
              {sessionType !== 'lifting' && (
                <span className="text-[#CCC1B5] font-normal ml-1">(optional)</span>
              )}
            </label>
            <input
              type="text"
              value={workoutName}
              onChange={e => setWorkoutName(e.target.value)}
              placeholder={
                sessionType === 'running' ? 'e.g. Morning easy run' :
                sessionType === 'cycling' ? 'e.g. Sunday endurance ride' :
                'e.g. Push day'
              }
              className={inputCls}
            />
          </div>

          {/* ── Shared: duration ── */}
          <div className="flex flex-col gap-1.5">
            <label className={fieldLabelCls}>Duration (minutes)</label>
            <input
              type="number"
              min={0}
              value={duration}
              onChange={e => setDuration(e.target.value)}
              placeholder="e.g. 45"
              className={inputCls}
            />
          </div>

          {/* ════════════════ LIFTING ════════════════ */}
          {sessionType === 'lifting' && (
            <>
              {exercises.map((ex, exIdx) => (
                <div key={exIdx} className={cardCls}>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={ex.name}
                      onChange={e => updateExerciseName(exIdx, e.target.value)}
                      placeholder="Exercise name"
                      className={`${inputCls} flex-1 font-medium`}
                    />
                    {exercises.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeExercise(exIdx)}
                        className="text-[#CCC1B5] hover:text-red-400 text-sm px-2 transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2">
                      <span />
                      <span className={`${sectionLabelCls} text-center`}>Reps</span>
                      <span className={`${sectionLabelCls} text-center`}>kg</span>
                      <span />
                    </div>

                    {ex.sets.map((s, setIdx) => (
                      <div
                        key={setIdx}
                        className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-2 items-center"
                      >
                        <span className="text-xs text-[#9B8575] text-center font-semibold">{setIdx + 1}</span>
                        <input
                          type="number"
                          min={0}
                          value={s.reps === 0 ? '' : s.reps}
                          onChange={e => updateSet(exIdx, setIdx, 'reps', Number(e.target.value))}
                          placeholder="0"
                          className={`${inputCls} text-center`}
                        />
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={s.weight === 0 ? '' : s.weight}
                          onChange={e => updateSet(exIdx, setIdx, 'weight', Number(e.target.value))}
                          placeholder="0"
                          className={`${inputCls} text-center`}
                        />
                        {ex.sets.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => removeSet(exIdx, setIdx)}
                            className="text-[#CCC1B5] hover:text-red-400 text-lg leading-none transition-colors"
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
                    className="self-start text-xs font-semibold text-[#9B8575] hover:text-[#C4622A] transition-colors tracking-wide uppercase"
                  >
                    + Add set
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={addExercise}
                className="border border-dashed border-[#EDE5DB] rounded-2xl py-3.5 text-sm font-semibold text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A] transition-colors"
              >
                + Add exercise
              </button>

              {/* Lifting RPE */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Perceived effort</p>
                <div className="flex gap-1.5">
                  {RPE_VALUES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setRpe(String(v))}
                      className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${
                        rpe === String(v)
                          ? 'bg-[#C4622A] border-[#C4622A] text-white'
                          : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={workoutDate}
                  onChange={e => setWorkoutDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          )}

          {/* ════════════════ RUNNING ════════════════ */}
          {sessionType === 'running' && (
            <>
              {/* Distance & pace card */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Distance & pace</p>

                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={runDistance}
                    onChange={e => setRunDistance(e.target.value)}
                    placeholder="0.00"
                    className={`${inputCls} flex-1 text-2xl font-bold tracking-tight`}
                    style={{ fontFamily: 'Georgia, serif' }}
                  />
                  <div className="flex bg-[#F0E9E0] rounded-xl p-1 gap-0.5">
                    {(['km', 'mi'] as const).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setRunUnit(u)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                          runUnit === u
                            ? 'bg-white text-[#C4622A] shadow-sm'
                            : 'text-[#9B8575]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {runPace && (
                  <div className="flex items-center justify-between bg-[#FDF1EA] border border-[#ECD5C5] rounded-xl px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C4622A]">
                      Avg pace
                    </span>
                    <span className="text-xl font-bold text-[#C4622A]" style={{ fontFamily: 'Georgia, serif' }}>
                      {runPace}
                    </span>
                  </div>
                )}
              </div>

              {/* Run type */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Run type</p>
                <div className="flex flex-wrap gap-2">
                  {RUN_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRunType(t)}
                      className={`px-4 py-1.5 rounded-full border text-sm font-semibold capitalize transition-all ${
                        runType === t
                          ? 'bg-[#C4622A] border-[#C4622A] text-white'
                          : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Heart rate & elevation */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Heart rate & elevation</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Avg HR (bpm)</label>
                    <input
                      type="number"
                      min={0}
                      value={runAvgHR}
                      onChange={e => setRunAvgHR(e.target.value)}
                      placeholder="148"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Max HR (bpm)</label>
                    <input
                      type="number"
                      min={0}
                      value={runMaxHR}
                      onChange={e => setRunMaxHR(e.target.value)}
                      placeholder="172"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className={fieldLabelCls}>Elevation gain (m)</label>
                    <input
                      type="number"
                      min={0}
                      value={runElevGain}
                      onChange={e => setRunElevGain(e.target.value)}
                      placeholder="120"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* RPE tap grid */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Perceived effort (RPE)</p>
                <div className="flex gap-1.5">
                  {RPE_VALUES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSessionRPE(String(v))}
                      className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${
                        sessionRPE === String(v)
                          ? 'bg-[#C4622A] border-[#C4622A] text-white'
                          : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>
                  Notes <span className="text-[#CCC1B5] font-normal">(optional)</span>
                </label>
                <textarea
                  value={runNotes}
                  onChange={e => setRunNotes(e.target.value)}
                  rows={3}
                  placeholder="How did it feel? Any observations…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={workoutDate}
                  onChange={e => setWorkoutDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          )}

          {/* ════════════════ CYCLING ════════════════ */}
          {sessionType === 'cycling' && (
            <>
              {/* Distance & speed card */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Distance & speed</p>

                <div className="flex gap-2 items-center">
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={cycleDistance}
                    onChange={e => setCycleDistance(e.target.value)}
                    placeholder="0.00"
                    className={`${inputCls} flex-1 text-2xl font-bold tracking-tight`}
                    style={{ fontFamily: 'Georgia, serif' }}
                  />
                  <div className="flex bg-[#F0E9E0] rounded-xl p-1 gap-0.5">
                    {(['km', 'mi'] as const).map(u => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => setCycleUnit(u)}
                        className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                          cycleUnit === u
                            ? 'bg-white text-[#C4622A] shadow-sm'
                            : 'text-[#9B8575]'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                </div>

                {cycleSpeed && (
                  <div className="flex items-center justify-between bg-[#FDF1EA] border border-[#ECD5C5] rounded-xl px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-[#C4622A]">
                      Avg speed
                    </span>
                    <span className="text-xl font-bold text-[#C4622A]" style={{ fontFamily: 'Georgia, serif' }}>
                      {cycleSpeed}
                    </span>
                  </div>
                )}
              </div>

              {/* Ride type */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Ride type</p>
                <div className="flex flex-wrap gap-2">
                  {CYCLE_TYPES.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setCycleType(t)}
                      className={`px-4 py-1.5 rounded-full border text-sm font-semibold capitalize transition-all ${
                        cycleType === t
                          ? 'bg-[#C4622A] border-[#C4622A] text-white'
                          : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Power & cadence */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Power & cadence</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Avg power (W)</label>
                    <input
                      type="number"
                      min={0}
                      value={cycleAvgPower}
                      onChange={e => setCycleAvgPower(e.target.value)}
                      placeholder="210"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Avg cadence (rpm)</label>
                    <input
                      type="number"
                      min={0}
                      value={cycleCadence}
                      onChange={e => setCycleCadence(e.target.value)}
                      placeholder="88"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* Heart rate & elevation */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Heart rate & elevation</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Avg HR (bpm)</label>
                    <input
                      type="number"
                      min={0}
                      value={cycleAvgHR}
                      onChange={e => setCycleAvgHR(e.target.value)}
                      placeholder="142"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className={fieldLabelCls}>Max HR (bpm)</label>
                    <input
                      type="number"
                      min={0}
                      value={cycleMaxHR}
                      onChange={e => setCycleMaxHR(e.target.value)}
                      placeholder="168"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className={fieldLabelCls}>Elevation gain (m)</label>
                    <input
                      type="number"
                      min={0}
                      value={cycleElevGain}
                      onChange={e => setCycleElevGain(e.target.value)}
                      placeholder="850"
                      className={inputCls}
                    />
                  </div>
                </div>
              </div>

              {/* RPE tap grid */}
              <div className={cardCls}>
                <p className={sectionLabelCls}>Perceived effort (RPE)</p>
                <div className="flex gap-1.5">
                  {RPE_VALUES.map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setCycleRpe(String(v))}
                      className={`flex-1 h-9 rounded-lg border text-xs font-semibold transition-all ${
                        cycleRpe === String(v)
                          ? 'bg-[#C4622A] border-[#C4622A] text-white'
                          : 'bg-white border-[#EDE5DB] text-[#9B8575] hover:border-[#C4622A] hover:text-[#C4622A]'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>
                  Notes <span className="text-[#CCC1B5] font-normal">(optional)</span>
                </label>
                <textarea
                  value={cycleNotes}
                  onChange={e => setCycleNotes(e.target.value)}
                  rows={3}
                  placeholder="How did it feel? Any observations…"
                  className={`${inputCls} resize-none`}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={fieldLabelCls}>Date & Time</label>
                <input
                  type="datetime-local"
                  value={workoutDate}
                  onChange={e => setWorkoutDate(e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          )}

          {/* ── Error ── */}
          {error && (
            <p className="text-sm text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* ── Submit ── */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full h-13 bg-[#1C1612] text-[#FAF7F2] rounded-xl py-3.5 text-sm font-semibold hover:bg-[#2C2218] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Saving…' : 'Save session'}
          </button>

        </form>
      </div>
    </div>
  );
}