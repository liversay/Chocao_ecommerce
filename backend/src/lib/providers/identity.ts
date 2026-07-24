// Adaptador de verificación de identidad. No hay integración real: esta app
// es una demo de cumplimiento normativo, así que el "proveedor" es una
// simulación determinística. La interfaz queda lista para sustituirse por
// un proveedor real sin tocar el resto del sistema (RI-05 simplificado: sin
// biometría/prueba de vida en este alcance, solo aprobación estructural).
export interface VerificationInput {
  documentoCanonico: string;
}

export interface VerificationResult {
  estado: "APROBADO" | "RECHAZADO";
  motivo?: string;
}

export interface IdentityProvider {
  verify(input: VerificationInput): Promise<VerificationResult>;
}

// Regla determinística de la simulación: cualquier documento válido se
// aprueba, salvo que termine en "0000" (para poder demostrar el camino de
// rechazo en la demo sin depender de azar).
class MockIdentityProvider implements IdentityProvider {
  async verify({ documentoCanonico }: VerificationInput): Promise<VerificationResult> {
    if (documentoCanonico.endsWith("0000")) {
      return { estado: "RECHAZADO", motivo: "No se pudo verificar la identidad con el documento provisto" };
    }
    return { estado: "APROBADO" };
  }
}

export const identityProvider: IdentityProvider = new MockIdentityProvider();
