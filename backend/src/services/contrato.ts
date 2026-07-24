import crypto from "node:crypto";

// Genera el contenido HTML del contrato de compraventa (mismo patrón que el
// recibo imprimible existente — sin librería PDF nueva) y su hash de sellado
// (RE-02/RE-07). El frontend lo renderiza e imprime; aquí solo se produce el
// contenido y el hash que queda en el registro.
export interface DatosContrato {
  vehicleTitle: string;
  vin?: string;
  precio: number;
  adjudicatarioNombre: string;
  fecha: Date;
}

export function generarContratoHtml(datos: DatosContrato): { html: string; hash: string } {
  const html = `
    <h1>Contrato de compraventa</h1>
    <p>Vehículo: ${datos.vehicleTitle} ${datos.vin ? `(VIN ${datos.vin})` : ""}</p>
    <p>Precio: $${datos.precio.toLocaleString()}</p>
    <p>Adquirente: ${datos.adjudicatarioNombre}</p>
    <p>Fecha: ${datos.fecha.toISOString()}</p>
    <p>El vehículo se vende en el estado en que se encuentra, sin garantía de funcionamiento
    ni saneamiento por vicios ocultos.</p>
  `.trim();
  const hash = crypto.createHash("sha256").update(html).digest("hex");
  return { html, hash };
}
