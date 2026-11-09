import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { adminCredentials, isFirebaseConfigured, loginWithFirebase, logoutFromFirebase } from '../lib/firebase';
import { getIndiaDateKey } from '../lib/dates';
import { getCurrentMembershipStatus } from '../lib/membership';
import type { Activity, GymState, Member, PaymentRecord, Plan, GymSettings } from '../types';

const STORAGE_KEY = 'elite-edge-gym-state';
const AUTH_KEY = 'elite-edge-gym-auth';

const defaultSettings: GymSettings = {
  gymName: '',
  address: '',
  contactNumber: '',
  email: '',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  duplicateAttendanceWindowMinutes: 20,
  expiryWarningDays: 7,
  inactivityWarningDays: 7,
};

const createEmptyState = (): GymState => ({
  members: [],
  plans: [],
  attendance: [],
  payments: [],
  settings: defaultSettings,
  activities: [],
});

const loadState = (): GymState => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<GymState>;
      const demoMemberIds = new Set(['member-1', 'member-2', 'member-3']);
      const demoPlanIds = new Set(['plan-1', 'plan-2', 'plan-3', 'plan-4']);
      const demoPlanNames = new Set(['1 month', '3 months', '6 months', '12 months']);
      const members = (parsed.members ?? []).filter((member) => !demoMemberIds.has(member.id));
      const settings = { ...defaultSettings, ...(parsed.settings ?? {}) };
      if (settings.gymName === 'EliteEdge Gym') {
        settings.gymName = '';
        settings.address = '';
        settings.contactNumber = '';
        settings.email = '';
      }

      return {
        members,
        plans: (parsed.plans ?? []).filter((plan) => !demoPlanIds.has(plan.id) && !demoPlanNames.has(plan.name.trim().toLowerCase())),
        attendance: (parsed.attendance ?? []).filter((record) => !demoMemberIds.has(record.memberId)),
        payments: (parsed.payments ?? []).filter((payment) => !demoMemberIds.has(payment.memberId)),
        settings,
        activities: (parsed.activities ?? []).filter((activity) => !/Ananya Kapoor|Rahul Sharma|Neha Verma/i.test(activity.title)),
      };
    }
  } catch {
    // Ignore parse errors and use defaults.
  }

  return createEmptyState();
};

type GymContextValue = {
  state: GymState;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  addMember: (member: Member) => void;
  updateMember: (member: Member) => void;
  removeMember: (memberId: string) => void;
  addPlan: (plan: Plan) => void;
  removePlan: (planId: string) => void;
  setSettings: (settings: GymSettings) => void;
  addPayment: (payment: PaymentRecord) => void;
  recordPayment: (payment: PaymentRecord, updatedMember: Member) => void;
  addAttendance: (record: { memberId: string; memberName: string; checkInTime: string; method?: 'QR' | 'Manual'; }) => boolean;
  addActivity: (activity: Activity) => void;
  stats: {
    totalMembers: number;
    activeMembers: number;
    expiredMembers: number;
    expiringSoon: number;
    todayAttendance: number;
    monthlyRevenue: number;
    pendingPayments: number;
    totalRevenue: number;
  };
  refreshFromStorage: () => void;
};

const GymContext = createContext<GymContextValue | undefined>(undefined);

export function GymProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GymState>(() => loadState());
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(AUTH_KEY);
    return saved === 'true';
  });

  const saveToStorage = useCallback((nextState: GymState) => {
    setState(nextState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }, []);

  const refreshFromStorage = useCallback(() => {
    setState(loadState());
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      if (!isFirebaseConfigured) {
        const valid = email === adminCredentials.email && password === adminCredentials.password;
        if (!valid) return false;
        localStorage.setItem(AUTH_KEY, 'true');
        setIsAuthenticated(true);
        return true;
      }

      await loginWithFirebase(email, password);
      localStorage.setItem(AUTH_KEY, 'true');
      setIsAuthenticated(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (isFirebaseConfigured) {
        await logoutFromFirebase();
      }
    } finally {
      localStorage.removeItem(AUTH_KEY);
      setIsAuthenticated(false);
    }
  }, []);

  const addMember = useCallback((member: Member) => {
    const nextState = { ...state, members: [member, ...state.members] };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const updateMember = useCallback((updatedMember: Member) => {
    const nextState = {
      ...state,
      members: state.members.map((member) => (member.id === updatedMember.id ? updatedMember : member)),
    };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const removeMember = useCallback((memberId: string) => {
    const nextState = { ...state, members: state.members.filter((member) => member.id !== memberId) };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const addPlan = useCallback((plan: Plan) => {
    const nextState = { ...state, plans: [plan, ...state.plans] };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const removePlan = useCallback((planId: string) => {
    const nextState = { ...state, plans: state.plans.filter((plan) => plan.id !== planId) };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const setSettings = useCallback((settings: GymSettings) => {
    const nextState = { ...state, settings };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const addPayment = useCallback((payment: PaymentRecord) => {
    const nextState = { ...state, payments: [payment, ...state.payments] };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const recordPayment = useCallback((payment: PaymentRecord, updatedMember: Member) => {
    const nextState = {
      ...state,
      members: state.members.map((member) => member.id === updatedMember.id ? updatedMember : member),
      payments: [payment, ...state.payments],
      activities: [{
        id: `activity-${payment.id}`,
        type: 'payment' as const,
        title: `Payment recorded for ${updatedMember.fullName}`,
        createdAt: payment.paymentDate,
      }, ...state.activities].slice(0, 12),
    };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const addAttendance = useCallback((record: { memberId: string; memberName: string; checkInTime: string; method?: 'QR' | 'Manual'; }) => {
    const todayKey = getIndiaDateKey(new Date());
    const hasCheckedInToday = state.attendance.some((item) => item.memberId === record.memberId && getIndiaDateKey(new Date(item.scannedAt)) === todayKey);
    if (hasCheckedInToday) {
      return false;
    }

    const nextAttendance = {
      id: `att-${Date.now()}`,
      memberId: record.memberId,
      memberName: record.memberName,
      scannedAt: new Date().toISOString(),
      checkInTime: record.checkInTime,
      method: record.method ?? 'QR',
    };

    const nextState = { ...state, attendance: [nextAttendance, ...state.attendance] };
    saveToStorage(nextState);
    return true;
  }, [saveToStorage, state]);

  const addActivity = useCallback((activity: Activity) => {
    const nextState = { ...state, activities: [activity, ...state.activities].slice(0, 12) };
    saveToStorage(nextState);
  }, [saveToStorage, state]);

  const stats = useMemo(() => {
    const todayKey = getIndiaDateKey(new Date());
    const activeMembers = state.members.filter((member) => getCurrentMembershipStatus(member, todayKey) === 'Active').length;
    const expiredMembers = state.members.filter((member) => getCurrentMembershipStatus(member, todayKey) === 'Expired').length;
    const expiringSoon = state.members.filter((member) => getCurrentMembershipStatus(member, todayKey) === 'Expiring Soon').length;
    const todayAttendance = state.attendance.filter((item) => getIndiaDateKey(new Date(item.scannedAt)) === todayKey).length;
    const monthlyRevenue = state.payments
      .filter((payment) => new Date(payment.paymentDate).getMonth() === new Date().getMonth())
      .reduce((sum, payment) => sum + payment.amountPaid, 0);
    const pendingPayments = state.payments.filter((payment) => payment.paymentStatus === 'Pending' || payment.paymentStatus === 'Partially Paid').reduce((sum, payment) => sum + payment.remainingBalance, 0);
    const totalRevenue = state.payments.reduce((sum, payment) => sum + payment.amountPaid, 0);

    return {
      totalMembers: state.members.length,
      activeMembers,
      expiredMembers,
      expiringSoon,
      todayAttendance,
      monthlyRevenue,
      pendingPayments,
      totalRevenue,
    };
  }, [state]);

  return (
    <GymContext.Provider value={{ state, isAuthenticated, login, logout, addMember, updateMember, removeMember, addPlan, removePlan, setSettings, addPayment, recordPayment, addAttendance, addActivity, stats, refreshFromStorage }}>
      {children}
    </GymContext.Provider>
  );
}

export function useGym() {
  const context = useContext(GymContext);
  if (!context) {
    throw new Error('useGym must be used within a GymProvider');
  }
  return context;
}
