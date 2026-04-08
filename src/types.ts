// Database row types (match schema.sql)

export interface Exercise {
  id: string;
  name: string;
}

export interface Workout {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  duration: number;
  session_type: 'lifting' | 'running' | 'cycling';
}

export interface CyclingSession {
  id: string;
  workout_id: string;
  distance: number;               // stored in km
  avg_speed: number | null;       // km/h (derived)
  avg_power: number | null;       // watts
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  avg_cadence: number | null;     // rpm
  elevation_gain: number | null;  // meters
  ride_type: string;
  notes: string | null;
}

export interface RunningSession {
  id: string;
  workout_id: string;
  distance: number;               // stored in km
  avg_pace: number | null;        // seconds per km
  avg_heart_rate: number | null;
  max_heart_rate: number | null;
  elevation_gain: number | null;  // meters
  run_type: string;
  notes: string | null;
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  log_date: string;
  weight: number | null;
  steps: number | null;
  calories: number | null;
  sleep_hours: number | null;
}

// Form / submission types

export interface NewWorkoutSet {
  exercise_id: string;
  exercise_name: string; // for free-text upsert flow
  set_number: number;
  weight: number;
  reps: number;
}

export interface NewWorkout {
  name: string;
  sets: NewWorkoutSet[];
}
