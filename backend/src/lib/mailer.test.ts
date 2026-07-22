import { afterEach, describe, expect, mock, test } from "bun:test";
import { sendEmail } from "./mailer";

describe("sendEmail", () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.RESEND_FROM;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalFrom === undefined) delete process.env.RESEND_FROM;
    else process.env.RESEND_FROM = originalFrom;
  });

  test("sin RESEND_API_KEY no llama a fetch y no lanza", async () => {
    delete process.env.RESEND_API_KEY;
    const fetchMock = mock(async () => new Response("{}"));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("con RESEND_API_KEY llama a la API de Resend con el payload correcto", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    process.env.RESEND_FROM = "Chocao <no-reply@chocao.test>";
    const fetchMock = mock(async () => new Response("{}", { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer re_test_123");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      from: "Chocao <no-reply@chocao.test>",
      to: ["a@test.dev"],
      subject: "Hola",
      html: "<p>hi</p>",
    });
  });

  test("si fetch falla, no lanza (best-effort)", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    globalThis.fetch = mock(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    await expect(
      sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" })
    ).resolves.toBeUndefined();
  });

  test("si Resend responde con error HTTP, no lanza", async () => {
    process.env.RESEND_API_KEY = "re_test_123";
    globalThis.fetch = mock(async () => new Response("{}", { status: 422 })) as unknown as typeof fetch;

    await expect(
      sendEmail({ to: "a@test.dev", subject: "Hola", html: "<p>hi</p>" })
    ).resolves.toBeUndefined();
  });
});
