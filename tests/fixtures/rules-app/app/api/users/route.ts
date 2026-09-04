export async function POST(request: Request) {
  const body = await request.json();
  return Response.json(body);
}

export async function GET() {
  return Response.json({ ok: true });
}
