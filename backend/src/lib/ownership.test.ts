import { describe, expect, test } from "bun:test";
import { Types } from "mongoose";
import { ForbiddenError } from "./errors";
import { assertOwner } from "./ownership";
import type { UserDoc } from "../models/User";

function fakeUser(id: Types.ObjectId): UserDoc {
  return { _id: id, role: "customer" } as unknown as UserDoc;
}

describe("assertOwner", () => {
  test("el dueño del recurso pasa", () => {
    const id = new Types.ObjectId();
    expect(() => assertOwner(id, fakeUser(id))).not.toThrow();
    expect(() => assertOwner(id.toString(), fakeUser(id))).not.toThrow();
  });

  test("otro usuario recibe ForbiddenError (403)", () => {
    const owner = new Types.ObjectId();
    const intruso = fakeUser(new Types.ObjectId());
    expect(() => assertOwner(owner, intruso)).toThrow(ForbiddenError);
    try {
      assertOwner(owner, intruso, "No tienes permisos sobre esta puja");
    } catch (e) {
      expect((e as ForbiddenError).status).toBe(403);
      expect((e as Error).message).toBe("No tienes permisos sobre esta puja");
    }
  });

  test("un admin tampoco puede operar pagos ajenos (sin bypass)", () => {
    const owner = new Types.ObjectId();
    const admin = { _id: new Types.ObjectId(), role: "admin" } as unknown as UserDoc;
    expect(() => assertOwner(owner, admin)).toThrow(ForbiddenError);
  });
});
