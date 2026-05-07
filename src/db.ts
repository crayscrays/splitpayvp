import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
    _client = createClient(url, key);
  }
  return _client;
}

export interface GroupMember {
  walletAddress: string;
  displayName: string;
  avatar?: string;
  roles?: string[];
}

export interface Split {
  wallet: string;
  amount: number;
  settled: boolean;
  txHash?: string;
  settledAt?: string;
}

export interface Expense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  paidBy: string;
  splitType: "equal" | "custom";
  splits: Split[];
  createdAt: string;
}

export async function publishGroup(group: {
  id: string;
  name: string;
  avatar: string;
  inviteCode: string;
}): Promise<void> {
  try {
    const { error } = await db()
      .from("groups")
      .upsert(
        { id: group.id, name: group.name, avatar: group.avatar, invite_code: group.inviteCode },
        { onConflict: "id" }
      );
    if (error) console.error("[db] publishGroup error:", error.message);
  } catch (e) { console.error("[db] publishGroup threw:", e); }
}

export async function fetchGroupName(groupId: string): Promise<string | null> {
  try {
    const { data, error } = await db().from("groups").select("name").eq("id", groupId).single();
    if (error) { console.error("[db] fetchGroupName error:", error.message); return null; }
    return (data as { name: string } | null)?.name ?? null;
  } catch (e) { console.error("[db] fetchGroupName threw:", e); return null; }
}

export async function publishMember(groupId: string, member: GroupMember): Promise<void> {
  try {
    const { error } = await db()
      .from("group_members")
      .upsert(
        {
          group_id: groupId,
          wallet_address: member.walletAddress,
          display_name: member.displayName ?? "",
          avatar: member.avatar ?? "",
          roles: member.roles ?? [],
        },
        { onConflict: "group_id,wallet_address" }
      );
    if (error) console.error("[db] publishMember error:", error.message);
  } catch (e) { console.error("[db] publishMember threw:", e); }
}

export async function fetchMembers(groupId: string): Promise<GroupMember[]> {
  try {
    const { data } = await db()
      .from("group_members")
      .select("wallet_address, display_name, avatar, roles")
      .eq("group_id", groupId);
    return (data ?? []).map((r: Record<string, unknown>) => ({
      walletAddress: r.wallet_address as string,
      displayName: r.display_name as string,
      avatar: r.avatar as string | undefined,
      roles: r.roles as string[] | undefined,
    }));
  } catch {
    return [];
  }
}

export async function publishExpense(expense: Expense): Promise<void> {
  try {
    const { error } = await db().from("group_expenses").upsert({
      id: expense.id,
      group_id: expense.groupId,
      data: expense,
      updated_at: new Date().toISOString(),
    });
    if (error) console.error("[db] publishExpense error:", error.message);
  } catch (e) { console.error("[db] publishExpense threw:", e); }
}

export async function fetchExpenses(groupId: string): Promise<Expense[]> {
  try {
    const { data } = await db()
      .from("group_expenses")
      .select("data")
      .eq("group_id", groupId);
    return (data ?? []).map((r: Record<string, unknown>) => r.data as Expense);
  } catch {
    return [];
  }
}

export async function resolveInviteCode(
  code: string
): Promise<{ groupId: string; groupName: string } | null> {
  try {
    const { data } = await db()
      .from("invite_codes")
      .select("data")
      .eq("code", code.toUpperCase())
      .single();
    const info = (data as { data: Record<string, unknown> } | null)?.data;
    if (!info) return null;
    // App stores { id, name, creator, ... }; prefer that over legacy { groupId, groupName }
    const groupId = (info.id ?? info.groupId) as string | undefined;
    const groupName = (info.name ?? info.groupName ?? "Unknown Group") as string;
    if (!groupId) return null;
    return { groupId, groupName };
  } catch {
    return null;
  }
}

export async function publishInviteCode(code: string, info: object): Promise<void> {
  try {
    const { error } = await db()
      .from("invite_codes")
      .upsert({ code: code.toUpperCase(), data: info }, { onConflict: "code" });
    if (error) console.error("[db] publishInviteCode error:", error.message);
  } catch (e) { console.error("[db] publishInviteCode threw:", e); }
}
