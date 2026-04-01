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
}

export interface WorkoutSet {
  id: string;
  workout_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps: number;
  created_at: string;
  notes: string;
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
