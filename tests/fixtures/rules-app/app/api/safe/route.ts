import { createUserSchema } from "../../../lib/schema";

export async function POST(request: Request) {
  const input = createUserSchema.parse(await request.json());
  return Response.json(input);
}
