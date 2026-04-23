import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET() {
  const scriptPath = path.join(process.cwd(), "app.js");
  const script = await readFile(scriptPath, "utf8");

  return new Response(script, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
