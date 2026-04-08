create extension if not exists "uuid-ossp";

create table profile (
    user_id uuid primary key references auth.users(id) on delete cascade,
    first_name text,
    age integer,
    height numeric,
    sex text check (sex in ('male', 'female')),
    weight numeric,
    activity_level text,
    unit_preference text default 'metric' check (unit_preference in ('metric', 'imperial')),
    created_at timestamptz default now(),
    updated_at timestamptz default now()
)

create table exercises (
    id uuid primary key default uuid_generate_v4(),
    name text not null
);

create table cycling_sessions (
    id uuid primary key default uuid_generate_v4(),
    workout_id uuid not null references workouts(id) on delete cascade,
    distance numeric not null,           -- stored in km
    avg_speed numeric,                   -- km/h (derived)
    avg_power integer,                   -- watts (from power meter)
    avg_heart_rate integer,              -- bpm
    max_heart_rate integer,              -- bpm
    avg_cadence integer,                 -- rpm (rotations per minute)
    elevation_gain numeric,              -- meters
    ride_type text not null,             -- 'easy' | 'endurance' | 'tempo' | 'interval' | 'climb' | 'race'
    notes text
);

create table workouts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    duration integer not null,
    rpe numeric,
    session_type text not null,  -- 'lifting' | 'running' | 'cycling'
    created_at timestamptz default now()
);

create table workout_exercises (
    id uuid primary key default uuid_generate_v4(),
    workout_id uuid not null references workouts(id) on delete cascade,
    exercise_id uuid not null references exercises(id) on delete cascade,
    exercise_order integer not null,
    notes text
);


create table workout_sets(
    id uuid primary key default uuid_generate_v4(),
    workout_exercise_id uuid not null references workout_exercises(id) on delete cascade,
    set_number integer not null,
    weight numeric not null,
    reps integer not null,
    created_at timestamptz default now()
);

CREATE TABLE planned_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users NOT NULL,
  name          text NOT NULL,
  scheduled_date date NOT NULL,
  scheduled_time time NOT NULL,
  planned_duration integer NOT NULL,  -- minutes
  intensity     integer CHECK (intensity BETWEEN 1 AND 10),
  workout_type  text,                 -- e.g. 'strength', 'cardio', 'hiit'
  estimated_calories integer,
  linked_workout_id uuid REFERENCES workouts(id), -- set when user logs the actual session
  created_at    timestamptz DEFAULT now()
);



create table running_sessions (
    id uuid primary key default uuid_generate_v4(),
    workout_id uuid not null references workouts(id) on delete cascade,
    distance numeric not null,           -- stored in km
    avg_pace integer,                    -- seconds per km (derived from distance + duration)
    avg_heart_rate integer,              -- bpm
    max_heart_rate integer,              -- bpm
    elevation_gain numeric,              -- meters
    run_type text not null,              -- 'easy' | 'tempo' | 'interval' | 'long' | 'race'
    notes text
);

create table daily_logs (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    log_date date not null,
    weight numeric,
    steps integer,
    calories integer,
    sleep_hours numeric

);