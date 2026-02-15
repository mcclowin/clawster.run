/**
 * Dashboard — Server Component
 *
 * Reads bots directly from DB (no API call needed).
 * Renders the UEFI-style dashboard.
 */
import { getAuthUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { redirect } from "next/navigation";
import { DashboardClient } from "./client";

export default async function DashboardPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const db = getDb();
  const bots = db
    .prepare(
      `SELECT id, name, status, model, instance_size, cvm_endpoint, created_at, updated_at
       FROM bots WHERE user_id = ? AND status != 'terminated'
       ORDER BY created_at DESC`
    )
    .all(user.id) as Array<{
      id: string; name: string; status: string; model: string;
      instance_size: string; cvm_endpoint: string | null;
      created_at: string; updated_at: string;
    }>;

  return (
    <DashboardClient
      user={{ id: user.id, email: user.email }}
      initialBots={bots}
    />
  );
}
