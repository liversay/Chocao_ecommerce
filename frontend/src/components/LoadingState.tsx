interface Props {
  message?: string;
}

export default function LoadingState({ message = "Cargando..." }: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--sp-7)",
        gap: "var(--sp-4)",
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "var(--surface)",
          boxShadow: "var(--nm-out-md)",
          position: "relative",
          animation: "spin 1.4s linear infinite",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 6,
            borderRadius: "50%",
            border: "3px solid transparent",
            borderTopColor: "var(--primary-500)",
            borderRightColor: "var(--accent)",
          }}
        />
      </div>
      <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
