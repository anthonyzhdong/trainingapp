create extension if not exists "uuid-ossp";

create table exercises (
    id uuid primary key default uuid_generate_v4(),
    name text not null
);

create table workouts (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    duration integer not null,
    created_at timestamptz default now()
);

create table workout_sets(
    id uuid primary key default uuid_generate_v4(),
    workout_id uuid not null references workouts(id) on delete cascade,
    exercise_id uuid not null references exercises(id) on delete cascade,
    set_number integer not null,
    weight numeric not null,
    reps integer not null,
    notes text,
    created_at timestamptz default now()

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