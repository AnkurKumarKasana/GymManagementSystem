import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BrowserRouter, Navigate, NavLink, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BellRing, Dumbbell, FileText, LayoutDashboard, LogOut, QrCode, Settings, ShieldCheck, Trash2, Users, WalletCards } from 'lucide-react';
import { BarChart, Bar, Cell, LineChart, Line, PieChart, Pie, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';
import { toast, Toaster } from 'react-hot-toast';
import { useGym } from './context/GymContext';
import { isFirebaseConfigured } from './lib/firebase';
import { getIndiaDateKey, getRecentIndiaDateKeys } from './lib/dates';
import { getCurrentMembershipStatus } from './lib/membership';
import type { GymSettings, Member, PaymentRecord } from './types';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/members', label: 'Members', icon: Users },
  { to: '/attendance', label: 'Attendance', icon: QrCode },
  { to: '/memberships', label: 'Memberships', icon: Dumbbell },
  { to: '/payments', label: 'Payments', icon: WalletCards },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(value);

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value?: string) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
};

const addMonthsToDate = (dateValue: string, months: number) => {
  const [year, month, day] = dateValue.slice(0, 10).split('-').map(Number);
  const firstOfTargetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth(), Math.min(day, lastDay))).toISOString();
};

const statusColors: Record<string, string> = {
  Active: 'bg-emerald-500/15 text-emerald-300',
  'Expiring Soon': 'bg-amber-500/15 text-amber-300',
  Expired: 'bg-rose-500/15 text-rose-300',
  Paused: 'bg-sky-500/15 text-sky-300',
  Cancelled: 'bg-zinc-500/15 text-zinc-300',
};

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, isAuthReady } = useGym();
  if (!isAuthReady) {
    return <div className="flex min-h-screen items-center justify-center bg-[#04070d] text-zinc-400">Checking Firebase session…</div>;
  }
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useGym();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Login successful');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to sign in to Firebase.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#04070d] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-900/80 p-8 shadow-2xl shadow-emerald-900/20">
        <div className="mb-7 flex items-center gap-3">
          <div className="rounded-xl bg-emerald-500/15 p-3 text-emerald-300"><ShieldCheck /></div>
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Gym admin</p>
            <h1 className="text-2xl font-bold text-white">EliteEdge Admin</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1119] px-3 py-3 text-white outline-none ring-0 transition focus:border-emerald-500" type="email" required />
          </div>
          <div>
            <label className="mb-2 block text-sm text-zinc-300">Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1119] px-3 py-3 text-white outline-none ring-0 transition focus:border-emerald-500" type="password" required />
          </div>

          <button disabled={loading} className="w-full rounded-xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60">
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-5 text-center text-xs text-zinc-500">
          Sign in with the admin account created in Firebase Authentication.
        </p>
        {!isFirebaseConfigured && (
          <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
            Firebase configuration is missing. Add your project settings to .env.local and restart the app.
          </p>
        )}
      </div>
    </div>
  );
}

function AppShell() {
  const { state, logout, dataError } = useGym();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#04070d] text-white">
      <Toaster position="top-right" toastOptions={{ style: { background: '#111827', color: 'white' } }} />
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] gap-4 px-3 py-4 sm:gap-5 sm:px-5 lg:gap-6 lg:px-8">
        <aside className="hidden w-64 shrink-0 rounded-2xl border border-white/10 bg-zinc-900/80 p-4 lg:block xl:w-72">
          <div className="mb-6 flex items-center gap-3 px-2">
            <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-300"><Dumbbell /></div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Admin suite</p>
              <h2 className="text-lg font-semibold text-white">{state.settings.gymName || 'Your Gym'}</h2>
            </div>
          </div>

          <nav className="space-y-2">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${isActive ? 'bg-emerald-500 text-slate-950' : 'text-zinc-300 hover:bg-white/5 hover:text-white'}`}>
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </nav>

          <button onClick={handleLogout} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-3 text-sm text-zinc-300 transition hover:border-rose-500/50 hover:text-rose-300">
            <LogOut size={16} />
            Logout
          </button>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-0">
          <header className="mb-6 rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Overview</p>
                <h1 className="text-2xl font-bold text-white">Gym Management Console</h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-white/10 bg-[#0b1119] p-2 text-zinc-300"><BellRing size={18} /></div>
                <button onClick={handleLogout} className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 lg:hidden">Logout</button>
              </div>
            </div>
          </header>

          {dataError && (
            <div role="alert" className="mb-5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              Firebase data sync error: {dataError}
            </div>
          )}

          <Routes>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/members" element={<MembersPage />} />
            <Route path="/members/add" element={<MemberFormPage mode="add" />} />
            <Route path="/members/:id" element={<MemberDetailPage />} />
            <Route path="/members/:id/edit" element={<MemberFormPage mode="edit" />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/memberships" element={<MembershipsPage />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-7 border-t border-white/10 bg-zinc-950/95 px-1 pb-[env(safe-area-inset-bottom)] pt-2 backdrop-blur lg:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] leading-tight ${isActive ? 'text-emerald-300' : 'text-zinc-400'}`}
          >
            <Icon size={18} />
            <span className="max-w-full truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function DashboardPage() {
  const { state, stats } = useGym();
  const navigate = useNavigate();

  const memberStatusData = [
    { name: 'Active', value: stats.activeMembers },
    { name: 'Expired', value: stats.expiredMembers },
    { name: 'Expiring', value: stats.expiringSoon },
  ];

  const attendanceData = getRecentIndiaDateKeys(7).map((date) => ({
    date,
    name: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
    value: state.attendance.filter((record) => getIndiaDateKey(new Date(record.scannedAt)) === date).length,
  }));
  const todayKey = getIndiaDateKey(new Date());
  const [year, month] = todayKey.split('-').map(Number);
  const revenueMonths = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 - (5 - index), 1));
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
    return {
      key,
      name: date.toLocaleDateString('en-IN', { month: 'short', timeZone: 'UTC' }),
      value: state.payments
        .filter((payment) => getIndiaDateKey(new Date(payment.paymentDate)).slice(0, 7) === key)
        .reduce((total, payment) => total + payment.amountPaid, 0),
    };
  });

  const cards = [
    { label: 'Total Members', value: stats.totalMembers, icon: Users, to: '/members?filter=all' },
    { label: 'Active Members', value: stats.activeMembers, icon: ShieldCheck, to: '/members?filter=active' },
    { label: 'Expiring within 7 days', value: stats.expiringSoon, icon: BellRing, to: '/members?filter=expiring' },
    { label: "Today's Attendance", value: stats.todayAttendance, icon: QrCode, to: '/reports' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, to }) => (
          <button key={label} type="button" onClick={() => navigate(to)} className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 text-left transition hover:border-emerald-500/50 hover:bg-zinc-900">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-zinc-400">{label}</p>
              <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-300"><Icon size={18} /></div>
            </div>
            <h3 className="text-3xl font-bold text-white">{value}</h3>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <p className="mb-4 text-sm font-semibold text-zinc-200">Daily Attendance</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendanceData}>
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="value" fill="#34d399" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <p className="mb-4 text-sm font-semibold text-zinc-200">Membership Status</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={memberStatusData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={80} fill="#34d399" label>
                  {memberStatusData.map((entry, index) => (
                    <Cell key={entry.name} fill={['#34d399', '#f97316', '#fb7185'][index % 3]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <p className="mb-4 text-sm font-semibold text-zinc-200">Monthly Revenue</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueMonths}>
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#34d399" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
          <p className="mb-4 text-sm font-semibold text-zinc-200">Recent Activity</p>
          <div className="space-y-3">
            {state.activities.slice(0, 5).map((activity) => (
              <div key={activity.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b1119] p-3">
                <div>
                  <p className="text-sm text-white">{activity.title}</p>
                  <p className="mt-1 text-xs text-zinc-400">{formatDate(activity.createdAt)}</p>
                </div>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-300">{activity.type}</span>
              </div>
            ))}
            {state.activities.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No activity recorded yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersPage() {
  const { state, removeMember } = useGym();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const filter = searchParams.get('filter') ?? 'all';
  const todayKey = getIndiaDateKey(new Date());
  const expiringInFiveDays = new Date(new Date(`${todayKey}T00:00:00Z`).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const memberStatus = (member: Member) => getCurrentMembershipStatus(member, todayKey);
  const expiringCount = state.members.filter((member) => {
    const expiry = member.membershipExpiryDate.slice(0, 10);
    return member.isActive && !['Paused', 'Cancelled'].includes(member.status) && expiry >= todayKey && expiry <= expiringInFiveDays;
  }).length;
  const memberTabs = [
    { key: 'all', label: 'All members', count: state.members.length },
    { key: 'active', label: 'Active', count: state.members.filter((member) => memberStatus(member) === 'Active').length },
    { key: 'expired', label: 'Expired', count: state.members.filter((member) => memberStatus(member) === 'Expired').length },
    { key: 'expiring5', label: 'Expiring in 5 days', count: expiringCount },
  ];

  const filtered = state.members.filter((member) => {
    const searchableText = `${member.fullName} ${member.memberId} ${member.mobile} ${member.email ?? ''}`.toLowerCase();
    const matchesSearch = searchableText.includes(query.trim().toLowerCase());
    const membershipStatus = memberStatus(member);
    const expiry = member.membershipExpiryDate.slice(0, 10);
    const matchesFilter = filter === 'active'
      ? membershipStatus === 'Active'
      : filter === 'expiring'
        ? membershipStatus === 'Expiring Soon'
        : filter === 'expiring5'
          ? member.isActive && !['Paused', 'Cancelled'].includes(member.status) && expiry >= todayKey && expiry <= expiringInFiveDays
        : filter === 'expired'
          ? membershipStatus === 'Expired'
          : filter === 'pending'
            ? member.outstandingBalance > 0 || ['Pending', 'Partially Paid', 'Overdue'].includes(member.initialPaymentStatus)
            : true;

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Members</p>
          <h2 className="text-2xl font-bold text-white">Member directory</h2>
        </div>
        <a href="/members/add" className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950 hover:bg-emerald-400">Add member</a>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {memberTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setSearchParams(tab.key === 'all' ? {} : { filter: tab.key })}
            className={`flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
              filter === tab.key
                ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                : 'border-white/10 bg-zinc-900/80 text-zinc-300 hover:border-emerald-500/40'
            }`}
          >
            {tab.label}
            <span className={`rounded-full px-2 py-0.5 text-xs ${filter === tab.key ? 'bg-black/10' : 'bg-white/10'}`}>{tab.count}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-zinc-900/80 p-4 md:grid-cols-[1fr,220px]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, member ID, phone, or email" className="w-full rounded-xl border border-white/10 bg-[#0b1119] px-4 py-3 text-white outline-none focus:border-emerald-500" />
        <select value={filter} onChange={(event) => setSearchParams(event.target.value === 'all' ? {} : { filter: event.target.value })} className="rounded-xl border border-white/10 bg-[#0b1119] px-4 py-3 text-white">
          <option value="all">All members</option>
          <option value="active">Active</option>
          <option value="expiring">Expiring within 7 days</option>
          <option value="expiring5">Expiring in 5 days</option>
          <option value="expired">Expired</option>
          <option value="pending">Pending payments</option>
        </select>
      </div>

      <div className="grid gap-4">
        {filtered.map((member) => (
          <div key={member.id} className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-zinc-900/80 p-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-lg font-bold text-emerald-300">
                {member.fullName.slice(0, 1)}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{member.fullName}</h3>
                <p className="text-sm text-zinc-400">{member.memberId} • {member.mobile}</p>
                <p className="text-xs text-zinc-500">Expiry: {formatDate(member.membershipExpiryDate)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusColors[getCurrentMembershipStatus(member)] || 'bg-zinc-500/15 text-zinc-300'}`}>{getCurrentMembershipStatus(member)}</span>
              <a href={`/members/${member.id}`} className="rounded-xl border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10">View</a>
              <button
                type="button"
                aria-label={`Delete ${member.fullName}`}
                onClick={async () => {
                  if (window.confirm(`Delete ${member.fullName}? Their attendance and payment history will be retained.`)) {
                    try {
                      await removeMember(member.id);
                      toast.success('Member deleted. Financial and attendance history was retained.');
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Unable to delete member.');
                    }
                  }
                }}
                className="rounded-xl border border-rose-500/30 p-2 text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 bg-zinc-900/50 p-8 text-center text-zinc-500">
            {state.members.length === 0 ? 'No members have been added yet.' : 'No members match this search or filter.'}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberFormPage({ mode }: { mode: 'add' | 'edit' }) {
  const { state, addMember, updateMember, uploadMemberPhoto } = useGym();
  const { id } = useParams();
  const navigate = useNavigate();
  const existing = state.members.find((member) => member.id === id);
  const uploadPhotoInput = useRef<HTMLInputElement>(null);
  const capturePhotoInput = useRef<HTMLInputElement>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');

  const createMemberForm = (member?: Member): Member => ({
    id: member?.id ?? `member-${Date.now()}`,
    memberId: member?.memberId ?? '',
    fullName: member?.fullName ?? '',
    mobile: member?.mobile ?? '',
    email: member?.email ?? '',
    gender: member?.gender ?? 'Male',
    membershipPlanId: member?.membershipPlanId ?? state.plans[0]?.id ?? '',
    joiningDate: member?.joiningDate ?? new Date().toISOString(),
    membershipStartDate: member?.membershipStartDate ?? new Date().toISOString(),
    membershipExpiryDate: member?.membershipExpiryDate ?? new Date(Date.now() + 30 * 86400000).toISOString(),
    membershipFee: member?.membershipFee ?? 0,
    discount: member?.discount ?? 0,
    finalPayable: member?.finalPayable ?? 0,
    initialPaymentStatus: member?.initialPaymentStatus ?? 'Pending',
    paymentMethod: member?.paymentMethod ?? 'Cash',
    notes: member?.notes ?? '',
    status: member?.status ?? 'Active',
    qrToken: member?.qrToken ?? `token-${Date.now()}`,
    isActive: member?.isActive ?? true,
    createdAt: member?.createdAt ?? new Date().toISOString(),
    lastVisit: member?.lastVisit,
    totalVisits: member?.totalVisits ?? 0,
    totalAmountPaid: member?.totalAmountPaid ?? 0,
    outstandingBalance: member?.outstandingBalance ?? 0,
    age: member?.age ?? 25,
    address: member?.address ?? '',
    emergencyContact: member?.emergencyContact ?? '',
    dob: member?.dob ?? '',
    photoUrl: member?.photoUrl ?? '',
  });
  const [form, setForm] = useState<Member>(() => createMemberForm(existing));

  useEffect(() => {
    if (!selectedPhoto) {
      setPhotoPreview('');
      return;
    }

    const objectUrl = URL.createObjectURL(selectedPhoto);
    setPhotoPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedPhoto]);

  useEffect(() => {
    if (mode === 'edit' && existing && form.id !== existing.id) {
      setForm(createMemberForm(existing));
    }
  }, [existing, form.id, mode]);

  useEffect(() => {
    if (mode !== 'add' || form.membershipPlanId || state.plans.length === 0) return;
    const plan = state.plans[0];
    setForm((current) => ({
      ...current,
      membershipPlanId: plan.id,
      membershipFee: plan.price,
      finalPayable: Math.max(plan.price - current.discount, 0),
      membershipExpiryDate: addMonthsToDate(current.membershipStartDate, plan.durationMonths),
    }));
  }, [form.membershipPlanId, form.membershipStartDate, mode, state.plans]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.membershipPlanId || (mode === 'add' && !state.plans.some((plan) => plan.id === form.membershipPlanId))) {
      toast.error('Select an available membership plan before saving.');
      return;
    }
    try {
      const memberId = mode === 'add' ? `member-${Date.now()}` : form.id;
      const photoUrl = selectedPhoto
        ? await uploadMemberPhoto(memberId, selectedPhoto)
        : form.photoUrl;
      const memberToSave = { ...form, id: memberId, photoUrl };
      if (mode === 'add') {
        await addMember(memberToSave);
        toast.success('Member added successfully');
      } else {
        await updateMember(memberToSave);
        toast.success('Member updated successfully');
      }
      navigate('/members');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save member.');
    }
  };

  const selectPhoto = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose a valid image file.');
      return;
    }
    if (file.size >= 5 * 1024 * 1024) {
      toast.error('Image must be smaller than 5 MB.');
      return;
    }
    setSelectedPhoto(file);
  };

  const fieldLabel = (label: string, required = false) => (
    <label className="mb-2 block text-sm font-medium text-zinc-300">
      {label}
      {required ? <span className="ml-1 text-emerald-300">*</span> : null}
    </label>
  );

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
      <h2 className="mb-4 text-2xl font-bold text-white">{mode === 'add' ? 'Add member' : 'Edit member'}</h2>
      <form onSubmit={submit} className="grid gap-5 md:grid-cols-2">
        <div className="md:col-span-2">
          {fieldLabel('Member Photo')}
          <div className="flex flex-col gap-4 rounded-xl border border-white/10 bg-[#0b1119] p-4 sm:flex-row sm:items-center">
            {(photoPreview || form.photoUrl) ? (
              <img src={photoPreview || form.photoUrl} alt="Member preview" className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/5 text-sm text-zinc-500">No photo</div>
            )}
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => uploadPhotoInput.current?.click()} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200">Upload photo</button>
              <button type="button" onClick={() => capturePhotoInput.current?.click()} className="rounded-xl bg-white/5 px-4 py-2 text-sm text-zinc-200">Take photo</button>
              <input ref={uploadPhotoInput} type="file" accept="image/*" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} />
              <input ref={capturePhotoInput} type="file" accept="image/*" capture="user" className="hidden" onChange={(event) => selectPhoto(event.target.files?.[0])} />
            </div>
          </div>
          <p className="mt-2 text-xs text-zinc-500">Images must be smaller than 5 MB. The photo uploads when you save the member.</p>
        </div>
        <div>
          {fieldLabel('Full Name', true)}
          <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Enter full name" />
        </div>
        <div>
          {fieldLabel('Mobile Number', true)}
          <input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Enter mobile number" />
        </div>
        <div>
          {fieldLabel('Email Address')}
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Enter email address" type="email" />
        </div>
        <div>
          {fieldLabel('Address')}
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Enter address" />
        </div>
        <div>
          {fieldLabel('Gender', true)}
          <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value as Member['gender'] })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white">
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          {fieldLabel('Age')}
          <input value={form.age ?? ''} onChange={(e) => setForm({ ...form, age: e.target.value === '' ? undefined : Number(e.target.value) })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" type="number" min="0" max="120" placeholder="Enter age" />
        </div>
        <div>
          {fieldLabel('Emergency Contact')}
          <input value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Enter emergency contact" />
        </div>
        <div>
          {fieldLabel('Joining Date')}
          <input value={form.joiningDate.slice(0, 10)} onChange={(e) => setForm({ ...form, joiningDate: new Date(e.target.value).toISOString() })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" type="date" />
        </div>
        <div>
          {fieldLabel('Membership Plan', true)}
          <select
            required
            value={form.membershipPlanId}
            onChange={(event) => {
              const plan = state.plans.find((item) => item.id === event.target.value);
              setForm({
                ...form,
                membershipPlanId: event.target.value,
                membershipFee: plan?.price ?? form.membershipFee,
                finalPayable: Math.max((plan?.price ?? form.membershipFee) - form.discount, 0),
                membershipExpiryDate: plan ? addMonthsToDate(form.membershipStartDate, plan.durationMonths) : form.membershipExpiryDate,
              });
            }}
            className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white"
          >
            <option value="" disabled>Select a custom plan</option>
            {mode === 'edit' && form.membershipPlanId && !state.plans.some((plan) => plan.id === form.membershipPlanId) && (
              <option value={form.membershipPlanId}>Previously assigned plan</option>
            )}
            {state.plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
          </select>
          {state.plans.length === 0 && mode === 'add' && <a href="/memberships" className="mt-2 inline-block text-xs text-emerald-300 hover:text-emerald-200">Create your custom plan first</a>}
        </div>
        <div>
          {fieldLabel('Membership Fee')}
          <input value={form.membershipFee} onChange={(e) => setForm({ ...form, membershipFee: Number(e.target.value) })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" type="number" min="0" placeholder="Enter fee" />
        </div>
        <div>
          {fieldLabel('Discount')}
          <input value={form.discount} onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" type="number" min="0" placeholder="Enter discount" />
        </div>
        <div>
          {fieldLabel('Final Payable Amount')}
          <input value={form.finalPayable} onChange={(e) => setForm({ ...form, finalPayable: Number(e.target.value) })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" type="number" min="0" placeholder="Enter final payable amount" />
        </div>
        <div>
          {fieldLabel('Membership Expiry Date')}
          <input value={form.membershipExpiryDate.slice(0, 10)} onChange={(e) => setForm({ ...form, membershipExpiryDate: new Date(e.target.value).toISOString() })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" type="date" />
        </div>
        <div>
          {fieldLabel('Payment Method')}
          <select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white">
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Online Payment">Online Payment</option>
          </select>
        </div>
        <div className="md:col-span-2">
          {fieldLabel('Additional Notes')}
          <textarea value={form.notes ?? ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" rows={4} placeholder="Add important notes for this member" />
        </div>
        <div className="md:col-span-2 flex justify-end gap-3">
          <button type="button" onClick={() => navigate('/members')} className="rounded-xl border border-white/10 px-5 py-3 text-zinc-300">Cancel</button>
          <button type="submit" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Save member</button>
        </div>
      </form>
    </div>
  );
}

function MemberDetailPage() {
  const { id } = useParams();
  const { state, removeMember } = useGym();
  const navigate = useNavigate();
  const member = state.members.find((item) => item.id === id);
  const memberPayments = state.payments.filter((payment) => payment.memberId === id);
  const membershipPlan = state.plans.find((plan) => plan.id === member?.membershipPlanId);
  const [qrUrl, setQrUrl] = useState('');

  useEffect(() => {
    if (!member) return;
    QRCode.toDataURL(member.qrToken).then(setQrUrl).catch(() => setQrUrl(''));
  }, [member]);

  if (!member) return <div className="text-white">Member not found.</div>;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {member.photoUrl
              ? <img src={member.photoUrl} alt={`${member.fullName} profile`} className="h-16 w-16 rounded-full object-cover" />
              : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-2xl font-bold text-emerald-300">{member.fullName.slice(0, 1)}</div>}
            <div>
              <h2 className="text-2xl font-bold text-white">{member.fullName}</h2>
              <p className="text-zinc-400">{member.memberId} • {member.mobile}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a href={`/members/${member.id}/edit`} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200">Edit</a>
            <button
              type="button"
              onClick={async () => {
                if (window.confirm(`Delete ${member.fullName}? Their attendance and payment history will be retained.`)) {
                  try {
                    await removeMember(member.id);
                    toast.success('Member deleted. Financial and attendance history was retained.');
                    navigate('/members');
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : 'Unable to delete member.');
                  }
                }
              }}
              className="rounded-xl border border-rose-500/30 px-4 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
            >
              Delete
            </button>
            <button onClick={() => window.print()} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950">Print card</button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5 lg:col-span-2">
          <h3 className="mb-4 text-lg font-semibold text-white">Membership details</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div><p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Plan</p><p className="text-white">{membershipPlan?.name ?? 'Plan unavailable'}</p></div>
            <div><p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Age</p><p className="text-white">{member.age != null ? `${member.age} years` : 'Not provided'}</p></div>
            <div><p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Expiry</p><p className="text-white">{formatDate(member.membershipExpiryDate)}</p></div>
            <div><p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Fee</p><p className="text-white">{formatCurrency(member.membershipFee)}</p></div>
            <div><p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Total paid</p><p className="text-white">{formatCurrency(member.totalAmountPaid)}</p></div>
            <div><p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Outstanding</p><p className="text-white">{formatCurrency(member.outstandingBalance)}</p></div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5">
          <h3 className="mb-4 text-lg font-semibold text-white">QR access</h3>
          {qrUrl ? <img src={qrUrl} alt="Member QR" className="mx-auto w-40 rounded-xl bg-white p-3" /> : <div className="h-40 animate-pulse rounded-xl bg-zinc-800" />}
          <div className="mt-4 flex gap-2">
            <a href={qrUrl} download={`qr-${member.memberId}.png`} className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-slate-950">Download PNG</a>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-5">
        <h3 className="mb-4 text-lg font-semibold text-white">Payment history</h3>
        {memberPayments.length > 0 ? (
          <div className="space-y-2">
            {memberPayments.map((payment) => (
              <div key={payment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1119] p-3">
                <div>
                  <p className="text-sm font-medium text-white">{payment.transactionRef}</p>
                  <p className="text-xs text-zinc-400">
                    {formatDate(payment.paymentDate)}
                    {payment.monthsCovered ? ` · ${payment.monthsCovered} ${payment.monthsCovered === 1 ? 'month' : 'months'} covered` : ''}
                  </p>
                </div>
                <span className="text-sm text-emerald-300">{formatCurrency(payment.amountPaid)}</span>
                <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-zinc-300">{payment.paymentStatus}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">No payments recorded for this member yet.</p>
        )}
      </div>
    </div>
  );
}

function AttendancePage() {
  const { state, addAttendance } = useGym();
  const [manualId, setManualId] = useState('');
  const [scannerReady, setScannerReady] = useState(false);
  const membersRef = useRef(state.members);

  const attemptCheckIn = async (member: Member, method: 'QR' | 'Manual') => {
    const todayKey = getIndiaDateKey(new Date());
    const alreadyCheckedInToday = state.attendance.some(
      (item) => item.memberId === member.id && getIndiaDateKey(new Date(item.scannedAt)) === todayKey,
    );

    if (alreadyCheckedInToday) {
      toast.error(`${member.fullName} attendance already marked for today.`);
      return;
    }

    const time = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
    let success: boolean;
    try {
      success = await addAttendance({
        memberId: member.id,
        memberName: member.fullName,
        checkInTime: time,
        method,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save attendance.');
      return;
    }

    if (!success) {
      toast.error(`${member.fullName} attendance already marked for today.`);
      return;
    }

    toast.success(`${member.fullName} checked in successfully`);
  };

  membersRef.current = state.members;
  const attemptCheckInRef = useRef(attemptCheckIn);
  attemptCheckInRef.current = attemptCheckIn;

  useEffect(() => {
    if (!scannerReady) return;

    const scanner = new Html5Qrcode('reader');
    let disposed = false;
    const startPromise = scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 280, height: 280 } },
      (result) => {
        const member = membersRef.current.find((item) => item.qrToken === result);
        if (!member) {
          toast.error('QR code not recognized.');
          return;
        }

        void attemptCheckInRef.current(member, 'QR');
      },
      () => undefined,
    ).catch((error: unknown) => {
      if (!disposed) {
        const message = error instanceof Error ? error.message : 'Camera access was denied or unavailable.';
        toast.error(`Unable to open the back camera: ${message}`);
        setScannerReady(false);
      }
    });

    return () => {
      disposed = true;
      void startPromise
        .then(() => scanner.isScanning ? scanner.stop() : undefined)
        .then(() => scanner.clear())
        .catch((error: unknown) => {
          if (scanner.isScanning) {
            toast.error(error instanceof Error ? error.message : 'Unable to stop the camera scanner.');
          }
        });
    };
  }, [scannerReady]);

  const handleManualCheckin = () => {
    const member = state.members.find((item) => item.memberId.toLowerCase() === manualId.trim().toLowerCase());
    if (!member) {
      toast.error('Member not found');
      return;
    }

    void attemptCheckIn(member, 'Manual');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Attendance</p>
            <h2 className="text-2xl font-bold text-white">QR scanner</h2>
          </div>
          <button onClick={() => setScannerReady((value) => !value)} className="rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-slate-950">{scannerReady ? 'Stop Scanner' : 'Start Scanner'}</button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="min-h-[320px] rounded-2xl border border-white/10 bg-[#0b1119] p-4">
            {scannerReady ? <div id="reader" /> : <div className="flex h-full items-center justify-center text-zinc-500">Camera preview is off. Tap Start Scanner to begin.</div>}
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0b1119] p-4">
            <label className="mb-2 block text-sm text-zinc-300">Manual member lookup</label>
            <input value={manualId} onChange={(e) => setManualId(e.target.value)} placeholder="IB-001" className="w-full rounded-xl border border-white/10 bg-[#04070d] px-3 py-3 text-white" />
            <button onClick={handleManualCheckin} className="mt-4 w-full rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">Mark attendance</button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
        <h3 className="mb-4 text-lg font-semibold text-white">Recent scans</h3>
        <div className="space-y-2">
          {state.attendance.slice(0, 6).map((record) => (
            <div key={record.id} className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0b1119] p-3 text-sm text-zinc-300">
              <span>{record.memberName}</span>
              <span>{record.method}</span>
              <span>{formatTime(record.scannedAt)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MembershipsPage() {
  const { state, addPlan, removePlan } = useGym();
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [price, setPrice] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await addPlan({
        id: `plan-${Date.now()}`,
        name: name.trim(),
        durationMonths: Number(duration),
        price: Number(price),
        description: `Custom ${duration}-month membership plan`,
        active: true,
        createdAt: new Date().toISOString(),
      });
      toast.success('Membership plan created');
      setName('');
      setDuration('');
      setPrice('');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save membership plan.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <h2 className="text-2xl font-bold text-white">Membership plans</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {state.plans.map((plan) => (
            <div key={plan.id} className="rounded-2xl border border-white/10 bg-[#0b1119] p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
                <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-emerald-300">Active</span>
              </div>
              <p className="text-2xl font-bold text-white">{formatCurrency(plan.price)}</p>
              <p className="mt-2 text-sm text-zinc-400">{plan.durationMonths} month plan</p>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm(`Delete the "${plan.name}" plan? Existing members will keep their saved membership details.`)) {
                    try {
                      await removePlan(plan.id);
                      toast.success('Membership plan deleted');
                    } catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Unable to delete membership plan.');
                    }
                  }
                }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10"
              >
                <Trash2 size={15} />
                Delete plan
              </button>
            </div>
          ))}
          {state.plans.length === 0 && (
            <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500 md:col-span-2 xl:col-span-4">
              No membership plans yet. Add your own plan below.
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <h3 className="text-lg font-semibold text-white">Member subscriptions</h3>
        {state.members.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-3">Member</th>
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Subscription date</th>
                  <th className="px-3 py-3">Expiry date</th>
                  <th className="px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {state.members.map((member) => {
                  const plan = state.plans.find((item) => item.id === member.membershipPlanId);
                  return (
                    <tr key={member.id} className="border-t border-white/10 text-zinc-300">
                      <td className="px-3 py-3">
                        <p className="font-medium text-white">{member.fullName}</p>
                        <p className="text-xs text-zinc-500">{member.memberId}</p>
                      </td>
                      <td className="px-3 py-3">{plan?.name ?? 'Plan deleted'}</td>
                      <td className="px-3 py-3">{formatDate(member.membershipStartDate || member.joiningDate)}</td>
                      <td className="px-3 py-3">{formatDate(member.membershipExpiryDate)}</td>
                      <td className="px-3 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs ${statusColors[getCurrentMembershipStatus(member)] ?? 'bg-zinc-500/15 text-zinc-300'}`}>{getCurrentMembershipStatus(member)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-white/10 p-4 text-sm text-zinc-500">Member subscriptions will appear here after you add members.</p>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <h3 className="text-lg font-semibold text-white">Add custom plan</h3>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-3">
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Plan name" className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" />
          <input required value={duration} onChange={(e) => setDuration(e.target.value)} type="number" min="1" placeholder="Duration in months" className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" />
          <input required value={price} onChange={(e) => setPrice(e.target.value)} type="number" min="0" placeholder="Plan fee (INR)" className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" />
          <div className="md:col-span-3 flex justify-end"><button type="submit" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Create plan</button></div>
        </form>
      </div>
    </div>
  );
}

function PaymentsPage() {
  const { state, recordPayment } = useGym();
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [showMemberOptions, setShowMemberOptions] = useState(false);
  const [amount, setAmount] = useState(0);
  const [monthsCovered, setMonthsCovered] = useState(1);
  const [method, setMethod] = useState('Cash');
  const [selectedRevenueMonth, setSelectedRevenueMonth] = useState(getIndiaDateKey(new Date()).slice(0, 7));
  const currentMonthKey = getIndiaDateKey(new Date()).slice(0, 7);
  const revenueMonths = Array.from({ length: 12 }, (_, index) => {
    const [year, month] = currentMonthKey.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1 - index, 1));
    return {
      key: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
      label: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    };
  });
  const selectedRevenue = state.payments
    .filter((payment) => getIndiaDateKey(new Date(payment.paymentDate)).slice(0, 7) === selectedRevenueMonth)
    .reduce((total, payment) => total + payment.amountPaid, 0);

  const matchingMembers = state.members.filter((member) => {
    const query = memberSearch.trim().toLowerCase();
    return query.length > 0 && `${member.fullName} ${member.mobile} ${member.memberId}`.toLowerCase().includes(query);
  }).slice(0, 8);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const member = state.members.find((item) => item.id === selectedMemberId);
    if (!member) {
      toast.error('Search for and select a member first.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a payment amount greater than zero.');
      return;
    }

    const amountDue = member.membershipFee * monthsCovered + member.outstandingBalance;
    const remainingBalance = Math.max(amountDue - amount, 0);
    const today = getIndiaDateKey(new Date());
    const currentExpiry = member.membershipExpiryDate.slice(0, 10);
    const extensionStart = currentExpiry > today ? currentExpiry : today;
    const membershipExpiryDate = addMonthsToDate(extensionStart, monthsCovered);
    const payment: PaymentRecord = {
      id: `pay-${Date.now()}`,
      memberId: member.id,
      membershipId: member.membershipPlanId,
      monthsCovered,
      amountDue,
      amountPaid: amount,
      remainingBalance,
      paymentDate: new Date().toISOString(),
      paymentMethod: method,
      paymentStatus: amount >= amountDue ? 'Paid' : 'Partially Paid',
      transactionRef: `REF-${Date.now()}`,
      recordedBy: 'Admin',
      notes: `Membership payment for ${monthsCovered} ${monthsCovered === 1 ? 'month' : 'months'}`,
    };

    const updatedMember: Member = {
      ...member,
      membershipExpiryDate,
      status: getCurrentMembershipStatus({ ...member, membershipExpiryDate }),
      totalAmountPaid: member.totalAmountPaid + amount,
      outstandingBalance: remainingBalance,
      initialPaymentStatus: remainingBalance === 0 ? 'Paid' : amount > 0 ? 'Partially Paid' : 'Pending',
      paymentMethod: method,
    };

    try {
      await recordPayment(payment, updatedMember);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save payment.');
      return;
    }
    toast.success(`Payment recorded for ${member.fullName}; membership extended to ${formatDate(membershipExpiryDate)}.`);
    setMemberSearch('');
    setSelectedMemberId('');
    setAmount(0);
    setMonthsCovered(1);
    setMethod('Cash');
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Revenue</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Monthly collections</h2>
            <p className="mt-1 text-sm text-zinc-400">Select a month to view payments recorded during that month.</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-3 md:min-w-56">
            <p className="text-sm text-zinc-400">Total revenue · {revenueMonths.find((month) => month.key === selectedRevenueMonth)?.label}</p>
            <p className="mt-1 text-2xl font-bold text-emerald-300">{formatCurrency(selectedRevenue)}</p>
          </div>
        </div>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
          {revenueMonths.map((month) => (
            <button
              key={month.key}
              type="button"
              onClick={() => setSelectedRevenueMonth(month.key)}
              className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-medium transition ${
                selectedRevenueMonth === month.key
                  ? 'border-emerald-500 bg-emerald-500 text-slate-950'
                  : 'border-white/10 bg-[#0b1119] text-zinc-300 hover:border-emerald-500/40'
              }`}
            >
              {month.label}
            </button>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <h2 className="text-2xl font-bold text-white">Payment management</h2>
        <form onSubmit={handleSubmit} className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="relative">
            <label htmlFor="payment-member-search" className="mb-2 block text-sm font-medium text-zinc-300">Find member by name or phone</label>
            <input
              id="payment-member-search"
              value={memberSearch}
              onChange={(event) => {
                setMemberSearch(event.target.value);
                setSelectedMemberId('');
                setShowMemberOptions(true);
              }}
              onFocus={() => setShowMemberOptions(true)}
              onBlur={() => window.setTimeout(() => setShowMemberOptions(false), 150)}
              autoComplete="off"
              placeholder="Type a name, phone number, or member ID"
              className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white"
              role="combobox"
              aria-expanded={showMemberOptions && matchingMembers.length > 0}
              aria-controls="payment-member-options"
            />
            {showMemberOptions && memberSearch.trim() && (
              <div id="payment-member-options" role="listbox" className="absolute z-20 mt-2 max-h-64 w-full overflow-y-auto rounded-xl border border-white/10 bg-zinc-900 p-2 shadow-xl">
                {matchingMembers.length > 0 ? matchingMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    role="option"
                    aria-selected={selectedMemberId === member.id}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      setSelectedMemberId(member.id);
                      setMemberSearch(`${member.fullName} · ${member.mobile}`);
                      setShowMemberOptions(false);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left hover:bg-white/5"
                  >
                    <span className="block font-medium text-white">{member.fullName}</span>
                    <span className="block text-xs text-zinc-400">{member.mobile} · {member.memberId}</span>
                  </button>
                )) : (
                  <p className="px-3 py-2 text-sm text-zinc-500">No matching members found.</p>
                )}
              </div>
            )}
            {selectedMemberId && (
              <p className="mt-2 text-xs text-emerald-300">Selected: {state.members.find((member) => member.id === selectedMemberId)?.fullName}</p>
            )}
          </div>
          <div>
            <label htmlFor="payment-amount" className="mb-2 block text-sm font-medium text-zinc-300">Amount received</label>
            <input id="payment-amount" required value={amount || ''} onChange={(e) => setAmount(Number(e.target.value))} type="number" min="0.01" step="0.01" placeholder="Enter amount" className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" />
          </div>
          <div>
            <label htmlFor="payment-months" className="mb-2 block text-sm font-medium text-zinc-300">Months covered</label>
            <select
              id="payment-months"
              value={monthsCovered}
              onChange={(event) => setMonthsCovered(Number(event.target.value))}
              className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white"
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((months) => (
                <option key={months} value={months}>{months} {months === 1 ? 'month' : 'months'}</option>
              ))}
            </select>
            {selectedMemberId && (
              <p className="mt-2 text-xs text-zinc-400">
                Plan fee: {formatCurrency(state.members.find((member) => member.id === selectedMemberId)?.membershipFee ?? 0)} / month
              </p>
            )}
          </div>
          <div>
            <label htmlFor="payment-method" className="mb-2 block text-sm font-medium text-zinc-300">Payment method</label>
            <select id="payment-method" value={method} onChange={(e) => setMethod(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white">
            <option value="Cash">Cash</option>
            <option value="UPI">UPI</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Online Payment">Online Payment</option>
            </select>
          </div>
          <div className="md:col-span-3 flex justify-end"><button type="submit" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Record payment</button></div>
        </form>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4">
        <h3 className="mb-4 text-lg font-semibold text-white">Payment history</h3>
        <div className="space-y-2">
          {state.payments.map((payment) => (
            <div key={payment.id} className="flex flex-col gap-2 rounded-xl border border-white/10 bg-[#0b1119] p-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-white">{state.members.find((member) => member.id === payment.memberId)?.fullName ?? 'Member record unavailable'} · {payment.transactionRef}</p>
                <p className="text-xs text-zinc-400">{formatDate(payment.paymentDate)}{payment.monthsCovered ? ` · ${payment.monthsCovered} ${payment.monthsCovered === 1 ? 'month' : 'months'}` : ''}</p>
              </div>
              <span className="text-sm text-emerald-300">{formatCurrency(payment.amountPaid)}</span>
              <span className="rounded-full bg-white/5 px-2 py-1 text-xs text-zinc-300">{payment.paymentStatus}</span>
            </div>
          ))}
          {state.payments.length === 0 && <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">No payments have been recorded yet.</p>}
        </div>
      </div>
    </div>
  );
}

function ReportsPage() {
  const { state } = useGym();
  const [selectedDate, setSelectedDate] = useState(getIndiaDateKey(new Date()));
  const chartData = getRecentIndiaDateKeys(7).map((date) => ({
    date,
    name: new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' }),
    members: state.attendance.filter((record) => getIndiaDateKey(new Date(record.scannedAt)) === date).length,
  }));
  const presentMembers = state.attendance
    .filter((record) => getIndiaDateKey(new Date(record.scannedAt)) === selectedDate)
    .sort((left, right) => left.checkInTime.localeCompare(right.checkInTime));

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Attendance reports</p>
            <h2 className="mt-1 text-2xl font-bold text-white">Daily member attendance</h2>
            <p className="mt-1 text-sm text-zinc-400">Attendance totals are grouped by India Standard Time.</p>
          </div>
          <label className="text-sm text-zinc-300">
            Show present members for
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="mt-2 block rounded-xl border border-white/10 bg-[#0b1119] px-3 py-2 text-white"
            />
          </label>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis dataKey="name" stroke="#9ca3af" />
              <YAxis stroke="#9ca3af" allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="members" name="Present members" fill="#34d399" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-white">Present members</h3>
            <p className="mt-1 text-sm text-zinc-400">{formatDate(`${selectedDate}T00:00:00`)} · {presentMembers.length} checked in</p>
          </div>
          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm text-emerald-300">{presentMembers.length} present</span>
        </div>
        {presentMembers.length > 0 ? (
          <div className="space-y-2">
            {presentMembers.map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0b1119] px-4 py-3">
                <div>
                  <p className="font-medium text-white">{record.memberName}</p>
                  <p className="text-xs text-zinc-500">{state.members.find((member) => member.id === record.memberId)?.memberId ?? 'Member record unavailable'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-zinc-200">{record.checkInTime}</p>
                  <p className="text-xs text-zinc-500">{record.method} check-in</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-zinc-500">No attendance has been recorded for this date.</p>
        )}
      </div>
    </div>
  );
}

function SettingsPage() {
  const { state, setSettings } = useGym();
  const [form, setForm] = useState<GymSettings>(state.settings);

  useEffect(() => {
    setForm(state.settings);
  }, [state.settings]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await setSettings(form);
      toast.success('Settings saved');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to save settings.');
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 p-6">
      <h2 className="text-2xl font-bold text-white">Gym settings</h2>
      <form onSubmit={save} className="mt-5 grid gap-4 md:grid-cols-2">
        <input value={form.gymName} onChange={(e) => setForm({ ...form, gymName: e.target.value })} className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Gym name" />
        <input value={form.contactNumber} onChange={(e) => setForm({ ...form, contactNumber: e.target.value })} className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Contact number" />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Email" />
        <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Address" />
        <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Currency" />
        <input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Timezone" />
        <input value={form.expiryWarningDays} onChange={(e) => setForm({ ...form, expiryWarningDays: Number(e.target.value) })} type="number" className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Expiry warning days" />
        <input value={form.inactivityWarningDays} onChange={(e) => setForm({ ...form, inactivityWarningDays: Number(e.target.value) })} type="number" className="rounded-xl border border-white/10 bg-[#0b1119] p-3 text-white" placeholder="Inactivity warning days" />
        <div className="md:col-span-2 flex justify-end"><button type="submit" className="rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950">Save settings</button></div>
      </form>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <GymAppRouter />
    </BrowserRouter>
  );
}

function GymAppRouter() {
  const { isAuthenticated } = useGym();

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
      <Route path="/*" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />
    </Routes>
  );
}
