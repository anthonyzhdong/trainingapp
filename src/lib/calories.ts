export const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: 'Sedentary',
  lightly_active: 'Lightly Active',
  moderately_active: 'Moderately Active',
  very_active: 'Very Active',
  extra_active: 'Extra Active',
};

export const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

/**
 * Mifflin-St Jeor BMR formula.
 * weight: kg, height: cm, age: years, sex: 'male' | 'female' | 'other'
 */
export function calculateBMR(
  weight: number,
  height: number,
  age: number,
  sex: string,
): number {
  const base = 10 * weight + 6.25 * height - 5 * age;
  if (sex === 'male') return Math.round(base + 5);
  if (sex === 'female') return Math.round(base - 161);
  return Math.round(base - 78); // 'other': midpoint of male/female
}

/**
 * Estimates total calories burned from a set of workouts.
 * duration: seconds, rpe: 1–10 (nullable)
 * Returns total kcal burned — divide by 7 for a weekly daily average,
 * or use directly for a single day.
 */
export function calculateWorkoutKcal(
  workouts: { duration: number; rpe: number | null }[],
): number {
  let totalKcal = 0;
  for (const w of workouts) {
    const minutes = w.duration / 60;
    const rpe = w.rpe;
    let kcalPerMin: number;
    if (rpe == null) kcalPerMin = 5;
    else if (rpe <= 4) kcalPerMin = 4;
    else if (rpe <= 7) kcalPerMin = 6;
    else kcalPerMin = 8;
    totalKcal += minutes * kcalPerMin;
  }
  return Math.round(totalKcal);
}

/**
 * Estimates calories burned from a running session.
 * distanceKm: kilometres run
 * weightKg: runner's body weight in kg
 * elevationGainM: total ascent in metres (optional, adds ~10% per 100 m)
 *
 * Formula: ~1 kcal per kg per km, with an elevation bonus.
 */
export function calculateRunningKcal(
  distanceKm: number,
  weightKg: number,
  elevationGainM: number = 0,
): number {
  const base = distanceKm * weightKg;
  const elevationBonus = base * (elevationGainM / 100) * 0.1;
  return Math.round(base + elevationBonus);
}

/**
 * Total Daily Energy Expenditure = BMR × lifestyle multiplier + workout bonus.
 */
export function calculateTDEE(
  bmr: number,
  activityLevel: string,
  workoutBonus: number,
): number {
  const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.2;
  return Math.round(bmr * multiplier) + workoutBonus;
}
