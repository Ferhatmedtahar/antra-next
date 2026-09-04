import { z } from "zod";

export const userSchema = z.object({
  id: z.string(),
  password: z.string(),
  address: z.object({ street: z.string() }),
});

export const loginInput = z.strictObject({
  email: z.string(),
  "api-key": z.string(),
});

export const notASchema = { password: "literal, not zod" };
