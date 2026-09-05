import { updateProfile } from "./actions";
import { ClientCard } from "./ClientCard";

// No directive: a Server Component by default.
export default async function ServerPage() {
  async function saveDraft(formData: FormData) {
    "use server";
    void formData;
  }

  return (
    <form action={saveDraft}>
      <ClientCard title="hello" />
      <button formAction={updateProfile}>Save</button>
    </form>
  );
}
