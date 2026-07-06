import { Link } from "react-router-dom";
import StatusBadge from "./StatusBadge";
import Countdown from "./Countdown";
import type { Vehicle } from "../types";

interface Props {
  vehicle: Vehicle;
}

const CAR_PLACEHOLDER = "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?w=600&q=80";

export default function VehicleCard({ vehicle }: Props) {
  const img = vehicle.images?.[0] || CAR_PLACEHOLDER;

  return (
    <Link to={`/vehicles/${vehicle._id}`} style={{ display: "block" }}>
      <article
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--nm-out-md)",
          overflow: "hidden",
          transition: "box-shadow 0.25s ease, transform 0.2s ease",
          cursor: "pointer",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--nm-out-lg)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.boxShadow = "var(--nm-out-md)";
          (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
        }}
      >
        <div
          style={{
            height: 200,
            background: "var(--bg-deep)",
            position: "relative",
            overflow: "hidden",
            margin: "10px 10px 0",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--nm-in-sm)",
          }}
        >
          <img
            src={img}
            alt={vehicle.title}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={(e) => { (e.target as HTMLImageElement).src = CAR_PLACEHOLDER; }}
          />
          <div style={{ position: "absolute", top: 12, right: 12 }}>
            <StatusBadge status={vehicle.status} />
          </div>
        </div>

        <div style={{ padding: "var(--sp-4) var(--sp-5) var(--sp-5)", flex: 1, display: "flex", flexDirection: "column" }}>
          <p
            style={{
              fontSize: "var(--t-xs)",
              color: "var(--text-soft)",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: 4,
            }}
          >
            {vehicle.brand} · {vehicle.year}
          </p>
          <h3
            style={{
              fontSize: "var(--t-md)",
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: "var(--sp-4)",
              lineHeight: 1.3,
            }}
          >
            {vehicle.title}
          </h3>

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
              <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>Base</p>
              <p style={{ fontSize: "var(--t-sm)", color: "var(--text-muted)", fontWeight: 600 }}>
                ${vehicle.basePrice.toLocaleString()}
              </p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "var(--t-xs)", color: "var(--text-soft)" }}>Oferta actual</p>
              <p
                style={{
                  fontSize: "var(--t-lg)",
                  color: "var(--accent)",
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                ${vehicle.currentPrice.toLocaleString()}
              </p>
            </div>
          </div>

          {vehicle.status === "active" && vehicle.auctionEndDate && (
            <div style={{ marginTop: "var(--sp-3)", display: "flex", justifyContent: "center" }}>
              <Countdown endDate={vehicle.auctionEndDate} variant="compact" />
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}
