import { getAuthUser } from "@/lib/auth";
import { dbAll } from "@/lib/db";
import { redirect } from "next/navigation";
import { DashboardClient } from "./client";

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const rawBots = await dbAll<Record<string, unknown>>(
    `SELECT id, name, status, model, instance_size, cvm_endpoint, created_at, updated_at
     FROM bots WHERE user_id = ? AND status != 'terminated' ORDER BY created_at DESC`,
    user.id
  );

  // Ensure all values are serializable primitives (no nested objects)
  const bots = rawBots.map(b => ({
    id: String(b.id || ""),
    name: String(b.name || ""),
    status: String(b.status || "pending"),
    model: String(b.model || ""),
    instance_size: String(b.instance_size || "small"),
    cvm_endpoint: b.cvm_endpoint ? String(b.cvm_endpoint) : null,
    created_at: String(b.created_at || ""),
    updated_at: String(b.updated_at || ""),
  }));

  return <DashboardClient user={{ id: user.id, email: user.email }} initialBots={bots} />;
}
