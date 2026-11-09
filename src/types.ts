export type Gender = 'Male' | 'Female' | 'Other';
export type MembershipStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Paused' | 'Cancelled';
export type PaymentStatus = 'Paid' | 'Partially Paid' | 'Pending' | 'Overdue' | 'Refunded';

export type GymSettings = {
  gymName: string;
  address: string;
  contactNumber: string;
  email: string;
  currency: string;
  timezone: string;
  duplicateAttendanceWindowMinutes: number;
  expiryWarningDays: number;
  inactivityWarningDays: number;
};

export type Plan = {
  id: string;
  name: string;
  durationMonths: number;
  price: number;
  description: string;
  active: boolean;
  createdAt: string;
};

export type Member = {
  id: string;
  memberId: string;
  fullName: string;
  mobile: string;
  email?: string;
  dob?: string;
  age?: number;
  gender: Gender;
  address?: string;
  emergencyContact?: string;
  photoUrl?: string;
  joiningDate: string;
  membershipPlanId: string;
  membershipStartDate: string;
  membershipExpiryDate: string;
  membershipFee: number;
  discount: number;
  finalPayable: number;
  initialPaymentStatus: PaymentStatus;
  paymentMethod: string;
  notes?: string;
  status: MembershipStatus;
  qrToken: string;
  qrCodeUrl?: string;
  isActive: boolean;
  createdAt: string;
  lastVisit?: string;
  totalVisits: number;
  totalAmountPaid: number;
  outstandingBalance: number;
};

export type AttendanceRecord = {
  id: string;
  memberId: string;
  memberName: string;
  scannedAt: string;
  checkInTime: string;
  method: 'QR' | 'Manual';
};

export type PaymentRecord = {
  id: string;
  memberId: string;
  membershipId?: string;
  monthsCovered?: number;
  amountDue: number;
  amountPaid: number;
  remainingBalance: number;
  paymentDate: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  transactionRef: string;
  recordedBy: string;
  notes?: string;
};

export type Activity = {
  id: string;
  type: 'member' | 'payment' | 'attendance' | 'renewal' | 'expiry';
  title: string;
  createdAt: string;
};

export type GymState = {
  members: Member[];
  plans: Plan[];
  attendance: AttendanceRecord[];
  payments: PaymentRecord[];
  settings: GymSettings;
  activities: Activity[];
};
