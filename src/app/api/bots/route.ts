/**
 * GET /api/bots
 *
 * List all bots for the authenticated user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { cookies } from "next/headers";

export async function GET(_req: NextRequest) {
  const user = await getAuthUser(await cookies());
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
