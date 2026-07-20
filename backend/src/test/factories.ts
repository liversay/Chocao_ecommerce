import { Bid, type IBid } from "../models/Bid";
import { User, type IUser, type UserDoc } from "../models/User";
import { Vehicle, type IVehicle, type VehicleDoc } from "../models/Vehicle";

let seq = 0;

export async function createUser(overrides: Partial<IUser> = {}): Promise<UserDoc> {
  seq += 1;
  return User.create({
    clerkId: `user_test_${seq}`,
    name: `Usuario ${seq}`,
    email: `usuario${seq}@test.dev`,
    role: "customer",
    ...overrides,
  });
}

export async function createVehicle(overrides: Partial<IVehicle> = {}): Promise<VehicleDoc> {
  seq += 1;
  const basePrice = overrides.basePrice ?? 10_000;
  return Vehicle.create({
    title: `Vehículo de prueba ${seq}`,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    basePrice,
    currentPrice: overrides.currentPrice ?? basePrice,
    status: "active",
    auctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

export async function createBid(
  vehicle: VehicleDoc,
  user: UserDoc,
  overrides: Partial<IBid> = {}
) {
  return Bid.create({
    vehicleId: vehicle._id,
    userId: user._id,
    amount: overrides.amount ?? vehicle.currentPrice + 1000,
    status: overrides.status ?? "active",
  });
}

// El mock de Clerk (mocks/clerk.ts) acepta el clerkId como token Bearer.
export function authHeader(user: UserDoc): Record<string, string> {
  return { Authorization: `Bearer ${user.clerkId}`, "Content-Type": "application/json" };
}
