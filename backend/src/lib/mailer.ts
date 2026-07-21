import { logger } from "./logger";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

// Envío de email best-effort: nunca lanza. Sin RESEND_API_KEY queda en modo
// log (desarrollo/demos); con la clave configurada llama a la API REST de
// Resend directamente por fetch (sin SDK adicional).
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    logger.info("email (dev, no enviado)", { to, subject });
    return;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Chocao <notificaciones@chocao.app>",
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      logger.error("Resend respondió con error", { status: res.status, to, subject });
    }
  } catch (err) {
    logger.error("no se pudo enviar el email", {
      to,
      subject,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
