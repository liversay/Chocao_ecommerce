// Plantilla única, minimalista, con la identidad visual de Chocao. title/body
// ya vienen redactados por el llamador (mismo texto que la notificación
// in-app), así que no hay una plantilla distinta por tipo de evento.
export function renderEmail(title: string, body: string): { subject: string; html: string } {
  return {
    subject: `Chocao · ${title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a2233;">
        <p style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #b88a2e; margin-bottom: 16px;">Chocao · Subastas de vehículos</p>
        <h1 style="font-size: 20px; margin-bottom: 12px;">${title}</h1>
        <p style="font-size: 14px; line-height: 1.6; color: #414552;">${body}</p>
        <p style="font-size: 11px; color: #8390a0; margin-top: 32px;">República de Panamá · Este es un mensaje automático, no respondas a este correo.</p>
      </div>
    `.trim(),
  };
}
