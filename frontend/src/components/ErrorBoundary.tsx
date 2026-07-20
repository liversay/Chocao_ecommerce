import React from "react";
import Button from "./Button";
import EmptyState from "./EmptyState";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Error boundary global: ante un error de render no controlado muestra una
// pantalla 500 con la identidad visual en lugar de la página en blanco.
// Nunca expone el stack trace al usuario.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="container" style={{ padding: "var(--sp-8) var(--sp-4)" }}>
        <EmptyState
          icon="⚠️"
          title="Algo salió mal (500)"
          description="Ocurrió un error inesperado en la aplicación. Intenta recargar la página; si el problema persiste, contáctanos."
          action={<Button onClick={() => window.location.reload()}>Recargar página</Button>}
        />
      </div>
    );
  }
}
