import { getAuthUser } from "@/lib/auth";
import { dbAll } from "@/lib/db";
import { redirect } from "next/navigation";
import { DashboardClient } from "./client";

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const bots = await dbAll<{
    id: string; name: string; status: string; model: string;
    instance_size: string; cvm_endpoint: string | null;
    created_at: string; updated_at: string;
  }>(
    `SELECT id, name, status, model, instance_size, cvm_endpoint, created_at, updated_at
     FROM bots WHERE user_id = ? AND status != 'terminated' ORDER BY created_at DESC`,
    user.id
  );

  return <DashboardClient user={{ id: user.id, email: user.email }} initialBots={bots} />;
}
