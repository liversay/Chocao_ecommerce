import { describe, expect, test } from "bun:test";
import { User } from "./User";
import { Vehicle } from "./Vehicle";
import { Bid } from "./Bid";
import { Payment } from "./Payment";
import { Adjudicacion } from "./Adjudicacion";

// Smoke test: los modelos cargan sin conectar a MongoDB y exponen los campos
// de los que depende el resto del backend.
describe("modelos", () => {
  test("User define clerkId, email y rol con default customer", () => {
    expect(User.schema.path("clerkId")).toBeDefined();
    expect(User.schema.path("email")).toBeDefined();
    expect(User.schema.path("role").options.default).toBe("customer");
  });

  test("Vehicle define el ciclo de vida de la subasta", () => {
    const status = Vehicle.schema.path("status") as unknown as { options: { enum: string[] } };
    expect(status.options.enum).toEqual(
      expect.arrayContaining(["draft", "published", "active", "closed", "awarded"]),
    );
    expect(Vehicle.schema.path("currentPrice")).toBeDefined();
    expect(Vehicle.schema.path("auctionEndDate")).toBeDefined();
  });

  test("Bid define los estados de puja", () => {
    const status = Bid.schema.path("status") as unknown as { options: { enum: string[] } };
    expect(status.options.enum).toEqual(
      expect.arrayContaining(["active", "outbid", "winner", "paid"]),
    );
  });

  test("Payment referencia sesión de Stripe y monto", () => {
    expect(Payment.schema.path("stripeSessionId")).toBeDefined();
    expect(Payment.schema.path("amount")).toBeDefined();
  });

  test("Payment define paidAt y referenciaPago (única, sparse)", () => {
    expect(Payment.schema.path("paidAt")).toBeDefined();
    const referenciaPago = Payment.schema.path("referenciaPago") as unknown as {
      options: { unique: boolean; sparse: boolean };
    };
    expect(referenciaPago.options.unique).toBe(true);
    expect(referenciaPago.options.sparse).toBe(true);
  });

  test("Adjudicacion define el ciclo de vida de RP-01/RP-02/RP-04/RP-05", () => {
    const estado = Adjudicacion.schema.path("estado") as unknown as { options: { enum: string[] } };
    expect(estado.options.enum).toEqual(
      expect.arrayContaining([
        "ADJUDICADA_PENDIENTE_PAGO",
        "PAGADA",
        "INCUMPLIDA",
        "OFERTA_A_SEGUNDO",
        "DESIERTO_POR_INCUMPLIMIENTO",
      ])
    );
    expect(Adjudicacion.schema.path("fechaLimitePago")).toBeDefined();
    expect(Adjudicacion.schema.path("segundoBidId")).toBeDefined();
  });
});
