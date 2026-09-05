import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(body);
}

export async function PUT(request: Request) {
  return NextResponse.json(await request.json());
}

export async function PATCH(request: Request) {
  return NextResponse.json(await request.json());
}

export const DELETE = async () => NextResponse.json({ ok: true });

function notExported() {
  return null;
}
