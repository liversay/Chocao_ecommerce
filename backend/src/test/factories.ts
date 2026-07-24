import { Bid, type IBid } from "../models/Bid";
import { Proponente } from "../models/Proponente";
import { User, type IUser, type UserDoc } from "../models/User";
import { Vehicle, type IVehicle, type VehicleDoc } from "../models/Vehicle";

let seq = 0;

// Por defecto crea también un Proponente ACREDITADO para el usuario (Task 5:
// placeBid exige acreditación vigente), para que los ~40 archivos de test
// que usan este fixture para pujar no tengan que conocer ese detalle. El
// documento canónico se deriva del mismo contador `seq` (formato NACIONAL
// que acepta normalizarDocumento) para que sea único por llamada y no
// choque con documentos hardcodeados en otros tests (p. ej. "8-888-8888").
// Para el caso negativo (usuario SIN acreditación), usar
// createUnaccreditedUser() o pasar { acreditado: false }.
export async function createUser(
  overrides: Partial<IUser> = {},
  options: { acreditado?: boolean } = {}
): Promise<UserDoc> {
  seq += 1;
  // IMPORTANTE: capturamos `seq` en una constante local ANTES del primer
  // await. `seq` es un contador de módulo compartido por todo el proceso de
  // test; con llamadas concurrentes (p. ej. Promise.all([createUser(),
  // createUser()])) cada invocación ya reservó su propio número aquí, pero
  // si más abajo volviéramos a leer la variable `seq` después de un await,
  // otra llamada concurrente podría haberla incrementado entretanto y dos
  // usuarios terminarían generando el mismo documento canónico (choque con
  // el índice único de Proponente.documento.canonico).
  const mySeq = seq;
  const user = await User.create({
    clerkId: `user_test_${mySeq}`,
    name: `Usuario ${mySeq}`,
    email: `usuario${mySeq}@test.dev`,
    role: "customer",
    ...overrides,
  });

  if (options.acreditado !== false) {
    const documento = `9-${String(mySeq).padStart(3, "0")}-${String(mySeq).padStart(4, "0")}`;
    await Proponente.create({
      userId: user._id,
      documento: { canonico: documento, original: documento, categoria: "NACIONAL" },
      estado: "ACREDITADO",
      aceptoPliego: true,
      aceptoPliegoEn: new Date(),
      verificacion: { estado: "APROBADO", verificadoEn: new Date() },
    });
  }

  return user;
}

// Usuario sin Proponente (ni siquiera BORRADOR) — el caso "no acreditado"
// que el gate de placeBid (Task 5) debe rechazar.
export async function createUnaccreditedUser(overrides: Partial<IUser> = {}): Promise<UserDoc> {
  return createUser(overrides, { acreditado: false });
}

export async function createVehicle(overrides: Partial<IVehicle> = {}): Promise<VehicleDoc> {
  seq += 1;
  const basePrice = overrides.basePrice ?? 10_000;
  return Vehicle.create({
    title: `Vehículo de prueba ${seq}`,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    basePrice,
    currentPrice: overrides.currentPrice ?? basePrice,
    status: "active",
    auctionEndDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ...overrides,
  });
}

export async function createBid(
  vehicle: VehicleDoc,
  user: UserDoc,
  overrides: Partial<IBid> = {}
) {
  return Bid.create({
    vehicleId: vehicle._id,
    userId: user._id,
    amount: overrides.amount ?? vehicle.currentPrice + 1000,
    status: overrides.status ?? "active",
  });
}

// El mock de Clerk (mocks/clerk.ts) acepta el clerkId como token Bearer.
export function authHeader(user: UserDoc): Record<string, string> {
  return { Authorization: `Bearer ${user.clerkId}`, "Content-Type": "application/json" };
}
