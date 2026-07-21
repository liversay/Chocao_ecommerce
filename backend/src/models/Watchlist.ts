import mongoose, { type HydratedDocument, Types } from "mongoose";

export interface IWatchlist {
  userId: Types.ObjectId;
  vehicleId: Types.ObjectId;
  createdAt: Date;
}

export type WatchlistDoc = HydratedDocument<IWatchlist>;

const watchlistSchema = new mongoose.Schema<IWatchlist>(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    vehicleId: { type: mongoose.Schema.Types.ObjectId, ref: "Vehicle", required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// Un vehículo aparece a lo sumo una vez en la watchlist de cada usuario.
watchlistSchema.index({ userId: 1, vehicleId: 1 }, { unique: true });

export const Watchlist = mongoose.model<IWatchlist>("Watchlist", watchlistSchema);
