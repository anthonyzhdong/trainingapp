import Sidebar from '@/components/Sidebar';

export default function Dashboard() {
  return (
    <div className="min-h-screen flex">
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 bg-gray-50 p-10">
        <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
        <p className="text-sm text-gray-500">Welcome back.</p>
      </main>
    </div>
  );
}
