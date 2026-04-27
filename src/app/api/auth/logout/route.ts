export async function POST() {
  const response = Response.json({ success: true });
  response.headers.set(
    "Set-Cookie",
    "zoraxyhub_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
  );
  return response;
}
