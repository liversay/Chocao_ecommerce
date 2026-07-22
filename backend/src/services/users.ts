import { Bid } from "../models/Bid";
import { User } from "../models/User";

export interface ListUsersParams {
  q?: string;
  role?: "customer" | "admin";
  page?: number;
  limit?: number;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Listado de usuarios para el backoffice, con el conteo de pujas de cada uno
// (para reconocer a los más activos de un vistazo).
export async function listUsers({ q, role, page = 1, limit = 20 }: ListUsersParams) {
  const filter: Record<string, unknown> = {};
  if (role) filter.role = role;
  if (q) {
    const rx = new RegExp(escapeRegex(q), "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }

  const [users, total] = await Promise.all([
    User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const bidCounts = await Bid.aggregate([
    { $match: { userId: { $in: users.map((u) => u._id) } } },
    { $group: { _id: "$userId", count: { $sum: 1 } } },
  ]);
  const countByUser = new Map(bidCounts.map((b) => [b._id.toString(), b.count as number]));

  return {
    items: users.map((u) => ({ ...u.toObject(), bidCount: countByUser.get(u._id.toString()) ?? 0 })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
  };
}
