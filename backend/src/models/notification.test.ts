import { describe, expect, test } from "bun:test";
import { Notification } from "./Notification";
import { Watchlist } from "./Watchlist";
import { User } from "./User";
import { Vehicle } from "./Vehicle";

describe("modelos de notificaciones y watchlist", () => {
  test("Notification define type, read y el shape de data", () => {
    const typePath = Notification.schema.path("type") as unknown as { options: { enum: string[] } };
    expect(typePath.options.enum).toEqual([
      "outbid",
      "won",
      "payment_confirmed",
      "refunded",
      "watch_closing",
    ]);
    expect(Notification.schema.path("read").options.default).toBe(false);
    expect(Notification.schema.path("userId")).toBeDefined();
  });

  test("Watchlist referencia userId y vehicleId", () => {
    expect(Watchlist.schema.path("userId")).toBeDefined();
    expect(Watchlist.schema.path("vehicleId")).toBeDefined();
  });

  test("User define notificationPrefs con las 4 llaves y default true", () => {
    const prefs = User.schema.path("notificationPrefs") as unknown as {
      schema: { path: (k: string) => { options: { default: unknown } } };
    };
    for (const key of ["outbid", "won", "payment", "watchClosing"]) {
      expect(prefs.schema.path(key).options.default).toBe(true);
    }
    expect(User.schema.path("phone")).toBeDefined();
  });

  test("Vehicle define closingSoonNotifiedAt", () => {
    expect(Vehicle.schema.path("closingSoonNotifiedAt")).toBeDefined();
  });
});
