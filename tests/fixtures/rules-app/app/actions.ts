"use server";

import { db } from "../lib/db";
import { profileSchema } from "../lib/schema";

export async function updateProfile(formData: FormData) {
  const input = profileSchema.parse(Object.fromEntries(formData));
  return input.name;
}

export async function deleteAccount(userId: string) {
  await db.user.delete(userId);
}

export async function refreshStats() {
  return Date.now();
}
