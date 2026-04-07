'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/dist/client/link';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { label: 'Add Workout', href: '/workout' },
  { label: 'History', href: '/history' },
  { label: 'Profile', href: '/profile' },
];

interface ProfileForm {
  first_name: string;
  age: string;
  height: string;
  sex: string;
  weight: string;
  activity_level: string;
}

export default function ProfilePage() {
  const pathname = usePathname();
  const router = useRouter();
  const [form, setForm] = useState<ProfileForm>({
    first_name: '',
    age: '',
    height: '',
    sex: '',
    weight: '',
    activity_level: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      const { data } = await supabase
        .from('profile')
        .select('first_name, age, height, sex, weight,activity_level')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setForm({
          first_name: data.first_name ?? '',
          age: data.age != null ? String(data.age) : '',
          height: data.height != null ? String(data.height) : '',
          sex: data.sex ?? '',
          weight: data.weight != null ? String(data.weight) : '',
          activity_level: data.activity_level ?? '',
        });
      }
      setLoading(false);
    }
    loadProfile();
  }, [router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('You must be logged in.');
        return;
      }

      const payload = {
        user_id: user.id,
        first_name: form.first_name || null,
        age: form.age ? parseInt(form.age) : null,
        height: form.height ? parseFloat(form.height) : null,
        sex: form.sex || null,
        weight: form.weight ? parseFloat(form.weight) : null,
        activity_level: form.activity_level || null,
      };

      const { error: upsertError } = await supabase
        .from('profile')
        .upsert(payload, { onConflict: 'user_id' });

      if (upsertError) {
        setError(upsertError.message);
      } else {
        setSuccess(true);
      }
    } finally {
      setSaving(false);
    }
  };

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
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Profile</h1>
        <p className="text-sm text-gray-500 mb-6">Update your personal information.</p>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-w-sm">
            {/* First name */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">First name</label>
              <input
                type="text"
                name="first_name"
                value={form.first_name}
                onChange={handleChange}
                placeholder="e.g. Alex"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Age */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Age</label>
              <input
                type="number"
                name="age"
                min={1}
                max={120}
                value={form.age}
                onChange={handleChange}
                placeholder="e.g. 28"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Sex */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Sex</label>
              <select
                name="sex"
                value={form.sex}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>

            {/* Height */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Height (cm)</label>
              <input
                type="number"
                name="height"
                min={1}
                step={0.1}
                value={form.height}
                onChange={handleChange}
                placeholder="e.g. 175"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Weight */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Weight (kg)</label>
              <input
                type="number"
                name="weight"
                min={1}
                step={0.1}
                value={form.weight}
                onChange={handleChange}
                placeholder="e.g. 75"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            {/* Activity level */}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Daily activity level</label>
              <select
                name="activity_level"
                value={form.activity_level}
                onChange={handleChange}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
              >
                <option value="">Select...</option>
                <option value="sedentary">Sedentary – desk job, little daily movement</option>
                <option value="lightly_active">Lightly Active – light walking, standing job</option>
                <option value="moderately_active">Moderately Active – some manual work or walking</option>
                <option value="very_active">Very Active – tradesperson, construction</option>
                <option value="extra_active">Extra Active – very hard physical labour all day</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">Profile saved.</p>}

            <button
              type="submit"
              disabled={saving}
              className="bg-gray-900 text-white rounded-lg py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
