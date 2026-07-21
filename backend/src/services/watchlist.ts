import { Watchlist, type WatchlistDoc } from "../models/Watchlist";
import type { UserDoc } from "../models/User";

export async function listWatchlist(user: UserDoc): Promise<WatchlistDoc[]> {
  return Watchlist.find({ userId: user._id }).populate("vehicleId").sort({ createdAt: -1 });
}

// Idempotente: reintentar agregar el mismo vehículo no crea duplicados ni
// falla — devuelve la fila existente.
export async function addToWatchlist(user: UserDoc, vehicleId: string): Promise<WatchlistDoc> {
  const existing = await Watchlist.findOne({ userId: user._id, vehicleId });
  if (existing) return existing;
  return Watchlist.create({ userId: user._id, vehicleId });
}

export async function removeFromWatchlist(user: UserDoc, vehicleId: string): Promise<void> {
  await Watchlist.deleteOne({ userId: user._id, vehicleId });
}
