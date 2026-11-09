import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { get, onValue, ref, remove, runTransaction, set, update } from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import { auth, database, isFirebaseConfigured, loginWithFirebase, logoutFromFirebase, storage } from '../lib/firebase';
import { getIndiaDateKey } from '../lib/dates';
import { getCurrentMembershipStatus } from '../lib/membership';
import type { Activity, AttendanceRecord, GymState, Member, PaymentRecord, Plan, GymSettings } from '../types';

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

type GymData = {
  members?: Record<string, Member>;
  plans?: Record<string, Plan>;
  attendance?: Record<string, AttendanceRecord>;
  payments?: Record<string, PaymentRecord>;
  activities?: Record<string, Activity>;
  settings?: Partial<GymSettings>;
};

type GymContextValue = {
  state: GymState;
  isAuthenticated: boolean;
  isAuthReady: boolean;
  dataError: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  addMember: (member: Member) => Promise<void>;
  updateMember: (member: Member) => Promise<void>;
  uploadMemberPhoto: (memberId: string, file: File) => Promise<string>;
  removeMember: (memberId: string) => Promise<void>;
  addPlan: (plan: Plan) => Promise<void>;
  removePlan: (planId: string) => Promise<void>;
  setSettings: (settings: GymSettings) => Promise<void>;
  recordPayment: (payment: PaymentRecord, updatedMember: Member) => Promise<void>;
  addAttendance: (record: { memberId: string; memberName: string; checkInTime: string; method?: 'QR' | 'Manual'; }) => Promise<boolean>;
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
};

const GymContext = createContext<GymContextValue | undefined>(undefined);

function getGymPath(userId: string, path = '') {
  return `gyms/${userId}${path ? `/${path}` : ''}`;
}

function getGymRef(userId: string, path = '') {
  if (!database) {
    throw new Error('Firebase Realtime Database is not configured. Check .env.local and restart the app.');
  }
  return ref(database, getGymPath(userId, path));
}

function valuesOf<T extends { id?: string }>(value?: Record<string, T>): T[] {
  if (!value) return [];
  return Object.entries(value).map(([id, item]) => ({ ...item, id: item.id ?? id }));
}

function memberSequence(memberId: string): number | null {
  const match = /^IB-(\d+)$/i.exec(memberId);
  return match ? Number(match[1]) : null;
}

function needsMemberIdMigration(members: Record<string, Member>): boolean {
  const seen = new Set<string>();
  return Object.values(members).some((member) => {
    const code = member.memberId?.toUpperCase() ?? '';
    if (!memberSequence(code) || seen.has(code)) return true;
    seen.add(code);
    return false;
  });
}

function migrateMemberIds(members: Record<string, Member>): Record<string, Member> {
  return Object.entries(members)
    .sort(([leftId, left], [rightId, right]) =>
      (left.createdAt ?? '').localeCompare(right.createdAt ?? '') || leftId.localeCompare(rightId))
    .reduce<Record<string, Member>>((migrated, [id, member], index) => {
      migrated[id] = { ...member, id: member.id ?? id, memberId: `IB-${String(index + 1).padStart(3, '0')}` };
      return migrated;
    }, {});
}

function omitUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefined(item)) as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, omitUndefined(item)]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}

function getFirebaseErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'An unexpected Firebase error occurred.';
}

export function GymProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GymState>(createEmptyState);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(!isFirebaseConfigured);
  const [dataError, setDataError] = useState('');
  const memberIdMigrationUser = useRef<string | null>(null);

  useEffect(() => {
    if (!auth) {
      setIsAuthReady(true);
      setUserId(null);
      return;
    }

    return onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid ?? null);
      setIsAuthReady(true);
      if (!user) {
        memberIdMigrationUser.current = null;
        setState(createEmptyState());
        setDataError('');
      }
    }, (error) => {
      setDataError(getFirebaseErrorMessage(error));
      setIsAuthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!userId || !database) {
      setState(createEmptyState());
      return;
    }

    setDataError('');
    return onValue(getGymRef(userId), (snapshot) => {
      const data = (snapshot.val() ?? {}) as GymData;
      setState({
        members: valuesOf(data.members),
        plans: valuesOf(data.plans),
        attendance: valuesOf(data.attendance).sort((left, right) => right.scannedAt.localeCompare(left.scannedAt)),
        payments: valuesOf(data.payments).sort((left, right) => right.paymentDate.localeCompare(left.paymentDate)),
        activities: valuesOf(data.activities).sort((left, right) => right.createdAt.localeCompare(left.createdAt)).slice(0, 12),
        settings: { ...defaultSettings, ...(data.settings ?? {}) },
      });

      if (memberIdMigrationUser.current !== userId) {
        memberIdMigrationUser.current = userId;
        if (data.members && needsMemberIdMigration(data.members)) {
          void runTransaction(getGymRef(userId, 'members'), (members) => {
            if (!members || typeof members !== 'object') return members;
            const currentMembers = members as Record<string, Member>;
            return needsMemberIdMigration(currentMembers) ? migrateMemberIds(currentMembers) : currentMembers;
          }).catch((error: unknown) => {
            setDataError(`Unable to update member IDs: ${getFirebaseErrorMessage(error)}`);
          });
        }
      }
    }, (error) => {
      setDataError(getFirebaseErrorMessage(error));
    });
  }, [userId]);

  const requireUserId = useCallback(() => {
    if (!database || !userId) throw new Error('Sign in before saving gym data.');
    return userId;
  }, [userId]);

  const login = useCallback(async (email: string, password: string) => {
    if (!isFirebaseConfigured) {
      throw new Error('Firebase is not configured. Check .env.local and restart the app.');
    }
    const user = await loginWithFirebase(email, password);
    setUserId(user.uid);
  }, []);

  const logout = useCallback(async () => {
    await logoutFromFirebase();
  }, []);

  const addMember = useCallback(async (member: Member) => {
    const currentUserId = requireUserId();
    const membersSnapshot = await get(getGymRef(currentUserId, 'members'));
    const members = membersSnapshot.val() as Record<string, Member> | null;
    const currentMax = Object.values(members ?? {}).reduce((max, existingMember) =>
      Math.max(max, memberSequence(existingMember.memberId ?? '') ?? 0), 0);
    const sequenceResult = await runTransaction(getGymRef(currentUserId, 'counters/memberId'), (current) =>
      Math.max(typeof current === 'number' ? current : 0, currentMax) + 1);
    if (!sequenceResult.committed) {
      throw new Error('Unable to allocate a unique member ID. Please try again.');
    }

    const assignedMember = {
      ...member,
      memberId: `IB-${String(sequenceResult.snapshot.val()).padStart(3, '0')}`,
    };
    await set(getGymRef(currentUserId, `members/${member.id}`), omitUndefined(assignedMember));
  }, [requireUserId]);

  const updateMember = useCallback(async (member: Member) => {
    const currentUserId = requireUserId();
    await set(getGymRef(currentUserId, `members/${member.id}`), omitUndefined(member));
  }, [requireUserId]);

  const uploadMemberPhoto = useCallback(async (memberId: string, file: File) => {
    const currentUserId = requireUserId();
    if (!storage) throw new Error('Firebase Storage is not configured.');
    const imageRef = storageRef(storage, `gyms/${currentUserId}/members/${memberId}/photo-${Date.now()}`);
    const uploaded = await uploadBytes(imageRef, file, { contentType: file.type });
    return getDownloadURL(uploaded.ref);
  }, [requireUserId]);

  const removeMember = useCallback(async (memberId: string) => {
    const currentUserId = requireUserId();
    await remove(getGymRef(currentUserId, `members/${memberId}`));
  }, [requireUserId]);

  const addPlan = useCallback(async (plan: Plan) => {
    const currentUserId = requireUserId();
    await set(getGymRef(currentUserId, `plans/${plan.id}`), plan);
  }, [requireUserId]);

  const removePlan = useCallback(async (planId: string) => {
    const currentUserId = requireUserId();
    await remove(getGymRef(currentUserId, `plans/${planId}`));
  }, [requireUserId]);

  const setSettings = useCallback(async (settings: GymSettings) => {
    const currentUserId = requireUserId();
    await set(getGymRef(currentUserId, 'settings'), settings);
  }, [requireUserId]);

  const recordPayment = useCallback(async (payment: PaymentRecord, updatedMember: Member) => {
    const currentUserId = requireUserId();
    const activity: Activity = {
      id: `activity-${payment.id}`,
      type: 'payment',
      title: `Payment recorded for ${updatedMember.fullName}`,
      createdAt: payment.paymentDate,
    };
    await update(getGymRef(currentUserId), omitUndefined({
      [`payments/${payment.id}`]: payment,
      [`members/${updatedMember.id}`]: updatedMember,
      [`activities/${activity.id}`]: activity,
    }));
  }, [requireUserId]);

  const addAttendance = useCallback(async (record: { memberId: string; memberName: string; checkInTime: string; method?: 'QR' | 'Manual'; }) => {
    const currentUserId = requireUserId();
    const now = new Date();
    const dateKey = getIndiaDateKey(now);
    const attendanceId = `${record.memberId}_${dateKey}`;
    const attendance: AttendanceRecord = {
      id: attendanceId,
      memberId: record.memberId,
      memberName: record.memberName,
      scannedAt: now.toISOString(),
      checkInTime: record.checkInTime,
      method: record.method ?? 'QR',
    };

    const result = await runTransaction(getGymRef(currentUserId, `attendance/${attendanceId}`), (existing) => {
      if (existing !== null) return;
      return omitUndefined(attendance);
    });
    return result.committed;
  }, [requireUserId]);

  const stats = useMemo(() => {
    const todayKey = getIndiaDateKey(new Date());
    const activeMembers = state.members.filter((member) => getCurrentMembershipStatus(member, todayKey) === 'Active').length;
    const expiredMembers = state.members.filter((member) => getCurrentMembershipStatus(member, todayKey) === 'Expired').length;
    const expiringSoon = state.members.filter((member) => getCurrentMembershipStatus(member, todayKey) === 'Expiring Soon').length;
    const todayAttendance = state.attendance.filter((item) => getIndiaDateKey(new Date(item.scannedAt)) === todayKey).length;
    const currentMonth = todayKey.slice(0, 7);
    const monthlyRevenue = state.payments
      .filter((payment) => getIndiaDateKey(new Date(payment.paymentDate)).slice(0, 7) === currentMonth)
      .reduce((sum, payment) => sum + payment.amountPaid, 0);
    const pendingPayments = state.payments
      .filter((payment) => payment.paymentStatus === 'Pending' || payment.paymentStatus === 'Partially Paid')
      .reduce((sum, payment) => sum + payment.remainingBalance, 0);
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

  const value = useMemo(() => ({
    state,
    isAuthenticated: Boolean(userId),
    isAuthReady,
    dataError,
    login,
    logout,
    addMember,
    updateMember,
    uploadMemberPhoto,
    removeMember,
    addPlan,
    removePlan,
    setSettings,
    recordPayment,
    addAttendance,
    stats,
  }), [
    state, userId, isAuthReady, dataError, login, logout, addMember, updateMember, uploadMemberPhoto,
    removeMember, addPlan, removePlan, setSettings, recordPayment, addAttendance, stats,
  ]);

  return <GymContext.Provider value={value}>{children}</GymContext.Provider>;
}

export function useGym() {
  const context = useContext(GymContext);
  if (!context) {
    throw new Error('useGym must be used within a GymProvider');
  }
  return context;
}
