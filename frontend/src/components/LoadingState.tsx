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
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: "3px solid var(--border)",
          borderTopColor: "var(--primary)",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <p style={{ color: "var(--text-muted)", fontSize: "var(--t-sm)" }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
