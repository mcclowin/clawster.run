import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const db = getDb();
  const bots = db
    .prepare(
      `SELECT id, name, status, model, instance_size, cvm_endpoint, created_at, updated_at
       FROM bots WHERE user_id = ? AND status != 'terminated'
       ORDER BY created_at DESC`
    )
    .all(user.id);

  return NextResponse.json({ bots });
}
