import { Link } from "react-router-dom";
import Card from "./Card";
import StatusBadge from "./StatusBadge";
import Countdown from "./Countdown";
import type { Vehicle } from "../types";
import { CONDITION_LABELS } from "../lib/labels";

interface Props {
  vehicle: Vehicle;
}

const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80";


export default function VehicleCard({ vehicle }: Props) {
  const img = vehicle.images?.[0] || CAR_PLACEHOLDER;

  return (
    <Link to={`/vehicles/${vehicle._id}`} style={{ display: "block", height: "100%" }}>
      <Card
        padding="none"
        interactive
        style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            aspectRatio: "16 / 10",
            overflow: "hidden",
            display: "block",
            lineHeight: 0,
            borderTopLeftRadius: "var(--radius-md)",
            borderTopRightRadius: "var(--radius-md)",
            borderBottom: "1px solid var(--hairline)",
          }}
        >
          <img
            loading="lazy"
            src={img}
            alt={vehicle.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center", display: "block" }}
            onError={(e) => { (e.target as HTMLImageElement).src = CAR_PLACEHOLDER; }}
          />
          <div style={{ position: "absolute", top: 12, right: 12 }}>
            <StatusBadge status={vehicle.status} />
          </div>
        </div>

        <div style={{ padding: "var(--sp-4) var(--sp-5) var(--sp-5)", flex: 1, display: "flex", flexDirection: "column" }}>
          <p className="eyebrow" style={{ marginBottom: 4 }}>
            {vehicle.brand} · {vehicle.year}
          </p>
          <h3 style={{ fontSize: "var(--t-md)", fontWeight: 600, color: "var(--text)", marginBottom: "var(--sp-3)", lineHeight: 1.3 }}>
            {vehicle.title}
          </h3>
          <p className="text-muted" style={{ fontSize: "var(--t-sm)", marginBottom: "var(--sp-4)" }}>
            {vehicle.mileage ? `${vehicle.mileage.toLocaleString()} km` : "—"} · {CONDITION_LABELS[vehicle.condition] || vehicle.condition}
          </p>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginTop: "auto",
              paddingTop: "var(--sp-3)",
              borderTop: "1px solid var(--hairline)",
            }}
          >
            <div>
              <p className="text-soft" style={{ fontSize: "var(--t-xs)" }}>Oferta actual</p>
              <p className="price-accent" style={{ fontSize: "var(--t-lg)", letterSpacing: "-0.02em" }}>
                ${vehicle.currentPrice.toLocaleString()}
              </p>
            </div>
            {vehicle.status === "active" && vehicle.auctionEndDate && (
              <Countdown endDate={vehicle.auctionEndDate} variant="compact" />
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}
