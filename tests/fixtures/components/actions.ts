"use server";

export async function updateProfile(formData: FormData) {
  await internalHelper(String(formData.get("name")));
}

export const deleteAccount = async (userId: string) => {
  await internalHelper(userId);
};

// Not exported: a plain helper, not a Server Action.
async function internalHelper(value: string) {
  return value;
}
