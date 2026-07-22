export interface NotificationPrefs {
  outbid: boolean;
  won: boolean;
  payment: boolean;
  watchClosing: boolean;
}

export interface User {
  _id: string;
  clerkId: string;
  name: string;
  email: string;
  role: "customer" | "admin";
  phone?: string;
  notificationPrefs: NotificationPrefs;
  createdAt: string;
}

export interface Vehicle {
  _id: string;
  title: string;
  brand: string;
  model: string;
  year: number;
  color: string;
  mileage: number;
  condition: "excellent" | "good" | "fair" | "poor";
  description: string;
  images: string[];
  basePrice: number;
  currentPrice: number;
  status: "draft" | "published" | "active" | "closed" | "awarded";
  auctionStartDate: string;
  auctionEndDate: string;
  createdAt: string;
}

export interface Bid {
  _id: string;
  vehicleId: Vehicle | string;
  userId: User | string;
  amount: number;
  status: "active" | "outbid" | "winner" | "paid";
  createdAt: string;
}

export interface Payment {
  _id: string;
  userId: string;
  vehicleId: string;
  bidId: string;
  stripeSessionId: string;
  amount: number;
  status: "pending" | "paid" | "cancelled";
  createdAt: string;
}

export interface DashboardSummary {
  totalVehicles: number;
  totalBids: number;
  totalUsers: number;
  totalRevenue: number;
  activeAuctions: number;
  awardedVehicles: number;
}

export interface AppNotification {
  _id: string;
  type: "outbid" | "won" | "payment_confirmed" | "refunded" | "watch_closing";
  title: string;
  body: string;
  data?: { vehicleId?: string; bidId?: string; paymentId?: string };
  read: boolean;
  createdAt: string;
}

export interface WatchlistItem {
  _id: string;
  vehicleId: Vehicle;
  createdAt: string;
}

export interface Receipt {
  paymentId: string;
  amount: number;
  paidAt: string;
  buyerName: string;
  buyerEmail: string;
  vehicle: { title: string; brand: string; model: string; year: number };
  stripeSessionId?: string;
}
