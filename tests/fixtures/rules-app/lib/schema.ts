import { z } from "zod";

export const profileSchema = z.object({ name: z.string() });
export const createUserSchema = z.object({ email: z.string() });
