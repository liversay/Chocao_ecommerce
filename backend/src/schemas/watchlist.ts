import { z } from "zod";
import { objectIdSchema } from "./common";

export const vehicleIdParamSchema = z.object({ vehicleId: objectIdSchema });
