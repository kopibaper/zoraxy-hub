export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initializeDatabase } = await import("./src/lib/db");
  initializeDatabase();
}
