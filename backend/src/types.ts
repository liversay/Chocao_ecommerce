import type { UserDoc } from "./models/User";

// Variables que los middlewares dejan en el contexto de Hono.
export type AppEnv = {
  Variables: {
    user: UserDoc;
    requestId: string;
  };
};
