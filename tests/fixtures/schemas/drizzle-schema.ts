import { integer, pgTable, serial, text } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  nickname: text(),
});

export const sessions = pgTable("sessions", (t) => ({
  token: t.text("token"),
  userId: integer("user_id"),
}));
