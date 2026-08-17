import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CONTRACT_SOURCE_PATH = join(
  process.cwd(),
  "contracts/cohold/src/lib.rs"
);

// The contract source is a repo file read at request time so the Inspector
// always shows the crate's lib.rs, never a copy.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const source = await readFile(CONTRACT_SOURCE_PATH, "utf8");
    return NextResponse.json({ success: true, source });
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to read contract source";
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}