// Exports HTTP-verb names but isn't named route.ts — must NOT classify as a
// route handler.
export async function POST(request: Request) {
  return request.json();
}
