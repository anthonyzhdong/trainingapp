'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const navItems = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Add Workout', href: '/workout' },
  { label: 'My Workouts', href: '/displayworkout' },
  { label: 'Daily Log', href: '/daily-log' },
  { label: 'History', href: '/history' },
  { label: 'Profile', href: '/profile' },
  
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
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
      <div className="mt-auto pt-4 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors text-left"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}
