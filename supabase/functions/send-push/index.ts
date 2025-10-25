// @ts-nocheck
// deno-lint-ignore-file no-explicit-any
// Supabase Edge Function: send-push
// Sends Expo push notifications to user_ids or raw tokens, honoring profile preferences.
// Requires env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// Deploy with: supabase functions deploy send-push --no-verify-jwt (or set JWT if needed)

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase forbids secrets starting with SUPABASE_ prefix. Use PROJECT_URL and SERVICE_ROLE_KEY.
const PROJECT_URL = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!PROJECT_URL || !SERVICE_ROLE_KEY) {
  throw new Error("Missing PROJECT_URL/SERVICE_ROLE_KEY (or SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY)");
}
const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

// Types
interface SendPushRequest {
  // One of these must be provided
  user_ids?: string[]; // target users
  tokens?: string[];   // raw Expo push tokens (for testing)

  type?: "message" | "like" | "match" | "friend_request" | "general";
  title: string;
  body: string;
  data?: Record<string, any>;
  channelId?: string; // android channel, default 'default'
}

interface ExpoMessage {
  to: string;
  title?: string;
  body?: string;
  sound?: "default" | null;
  data?: Record<string, any>;
  channelId?: string;
  priority?: "default" | "normal" | "high";
  ttl?: number;
  collapseId?: string;
}

interface ExpoTicket {
  id?: string;
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
    },
  });
}

function chunk<T>(arr: T[], size = 99): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function fetchUserTokens(userIds: string[], kind: SendPushRequest["type"]) {
  if (userIds.length === 0) return [] as { user_id: string; token: string }[];

  // 1) Fetch tokens per user
  const { data: tokens, error: tokErr } = await supabase
    .from("push_tokens")
    .select("user_id, token")
    .in("user_id", userIds);
  if (tokErr) throw tokErr;

  // 2) Fetch preferences from profiles
  const { data: prefs, error: prefErr } = await supabase
    .from("profiles")
    .select("id, push_opt_in, notify_messages, notify_likes, notify_friend_requests")
    .in("id", userIds);
  if (prefErr) throw prefErr;
  const prefMap = new Map<string, any>((prefs || []).map((p: any) => [p.id as string, p]));

  // 3) Filter tokens by preferences
  const out: { user_id: string; token: string }[] = [];
  for (const row of tokens || []) {
    const p = prefMap.get(row.user_id as string) || {};
    if (!p.push_opt_in) continue;
    switch (kind) {
      case "message":
        if (p.notify_messages === false) continue;
        break;
      case "like":
        if (p.notify_likes === false) continue;
        break;
      case "friend_request":
        if (p.notify_friend_requests === false) continue;
        break;
      case "match":
        if (p.notify_likes === false) continue;
        break;
      default:
        // general -> allowed by push_opt_in
        break;
    }
    out.push({ user_id: row.user_id as string, token: row.token as string });
  }
  return out;
}

async function sendExpo(messages: ExpoMessage[]): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];
  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Expo send failed: ${resp.status} ${text}`);
  }
  const json = await resp.json();
  const data = Array.isArray(json?.data) ? json.data : [json?.data];
  return (data || []) as ExpoTicket[];
}

async function cleanupInvalidTokens(tokens: string[]) {
  if (tokens.length === 0) return;
  await supabase.from("push_tokens").delete().in("token", tokens);
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type",
        },
      });
    }
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const body = (await req.json()) as SendPushRequest;
    if (!body) return json(400, { error: "Missing body" });

    const channelId = body.channelId ?? "default";
    const type = body.type ?? "general";

    let targetTokens: string[] = [];
    if (Array.isArray(body.tokens) && body.tokens.length > 0) {
      targetTokens = body.tokens;
    } else if (Array.isArray(body.user_ids) && body.user_ids.length > 0) {
      const rows = await fetchUserTokens(body.user_ids, type);
      targetTokens = rows.map((r) => r.token);
    } else {
      return json(400, { error: "Provide user_ids[] or tokens[]" });
    }

    // Build messages
    const base: Omit<ExpoMessage, "to"> = {
      title: body.title,
      body: body.body,
      sound: "default",
      data: { ...(body.data || {}), type },
      channelId,
      priority: "high",
      ttl: type === 'message' ? 60 : 3600,
    };

    const collapseId = type === 'message' && (body?.data as any)?.match_id
      ? `thread:${(body.data as any).match_id}`
      : undefined;

    const messages: ExpoMessage[] = targetTokens.map((t) => ({ to: t, collapseId, ...base }));

    const batches = chunk(messages, 99);
    const allTickets: ExpoTicket[] = [];
    for (const batch of batches) {
      const tickets = await sendExpo(batch);
      allTickets.push(...tickets);
    }

    // Cleanup invalid tokens
    const invalidErrs = new Set(["DeviceNotRegistered", "InvalidCredentials"]);
    const shouldDropTokens: string[] = [];
    // Response from Expo doesn't echo the token; we only know some errors are global; to be safe, we can drop none here,
    // or send single-by-single. As a compromise, when sending individually, we can map by index.
    // Here, since we batched, we won't attempt to map; optional: if batch size 1, map that token.
    if (messages.length === 1 && allTickets.length === 1) {
      const t = allTickets[0];
      if (t.status === "error" && t.details?.error && invalidErrs.has(t.details.error)) {
        shouldDropTokens.push(messages[0].to);
      }
    }
    if (shouldDropTokens.length) await cleanupInvalidTokens(shouldDropTokens);

    const errors = allTickets.filter((t) => t.status === "error");
    return json(200, { sent: messages.length, tickets: allTickets, errors });
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
