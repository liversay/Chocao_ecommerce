interface Props {
  size?: number;
}

export default function Logo({ size = 40 }: Props) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: "var(--primary)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Auctioneer's gavel mark */}
        <path
          d="M14.5 2.5L21.5 9.5M18 6L13 11M11 9L15 13M9 11L4 16M4 16L2 18M4 16L8 20M8 20L10 22M8 20L13 15"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
