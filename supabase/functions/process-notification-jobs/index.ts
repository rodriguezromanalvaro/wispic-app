// @ts-nocheck
// Supabase Edge Function: process-notification-jobs
// Picks pending jobs from public.notification_jobs, respects preferences, sends via Expo
// Requires env: PROJECT_URL or SUPABASE_URL, SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PROJECT_URL = Deno.env.get("PROJECT_URL") || Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!PROJECT_URL || !SERVICE_ROLE_KEY) throw new Error("Missing PROJECT_URL/SERVICE_ROLE_KEY");

const supabase = createClient(PROJECT_URL, SERVICE_ROLE_KEY);

function json(status: number, data: unknown) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*" },
  });
}

function chunk(arr: any[], size = 99) { const out = []; for (let i=0;i<arr.length;i+=size) out.push(arr.slice(i,i+size)); return out; }

async function fetchUserTokens(userId: string, kind: string) {
  const { data: tokens, error: tokErr } = await supabase
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);
  if (tokErr) throw tokErr;

  const { data: prefs, error: prefErr } = await supabase
    .from("profiles")
    .select("id, push_opt_in, notify_messages, notify_likes, notify_friend_requests")
    .eq("id", userId)
    .single();
  if (prefErr && prefErr.code !== 'PGRST116') throw prefErr; // maybe no profile

  const p: any = prefs || {};
  if (!p.push_opt_in) return [];
  switch (kind) {
    case "message": if (p.notify_messages === false) return []; break;
    case "like": if (p.notify_likes === false) return []; break;
    case "friend_request": if (p.notify_friend_requests === false) return []; break;
    case "match": if (p.notify_likes === false) return []; break;
    default: break;
  }
  return (tokens || []).map((r: any) => r.token as string);
}

async function sendExpo(messages: any[]) {
  if (!messages.length) return [] as any[];
  const resp = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(messages),
  });
  if (!resp.ok) throw new Error(`Expo send failed: ${resp.status} ${await resp.text()}`);
  const json = await resp.json();
  const data = Array.isArray(json?.data) ? json.data : [json?.data];
  return data || [];
}

async function claimNextJobs(limit = 50, debug = false) {
  // 1) Read candidates
  const { data, error } = await supabase
    .from("notification_jobs")
    .select("id, user_id, type, payload, attempts, scheduled_at")
    .eq("status", "pending")
    .order("scheduled_at", { ascending: true, nullsFirst: true } as any)
    .limit(Math.max(limit * 2, 50));
  if (error) throw error;
  const now = Date.now();
  const jobs = ((data || []) as any[]).filter((j) => {
    const s = j.scheduled_at ? Date.parse(j.scheduled_at) : null;
    return s === null || s <= now;
  }).slice(0, limit);

  // 2) Try to atomically flip to processing; skip if race
  const claimed: any[] = [];
  const attempts: any[] = [];
  for (const j of jobs) {
    const { data: upd, error: upErr } = await supabase
      .from("notification_jobs")
      .update({ status: "processing", attempts: (j.attempts || 0) + 1 })
      .eq("id", j.id)
      .eq("status", "pending")
      .select("id, user_id, type, payload, attempts")
      .single();
  if (debug) attempts.push({ id: j.id, upErr: upErr ? ((upErr as any)?.message || JSON.stringify(upErr)) : null, got: upd ? true : false });
    if (!upErr && upd) claimed.push({ ...j, ...upd });
  }
  return debug ? { claimed, attempts } as any : claimed;
}

function buildMessage(type: string, payload: any) {
  switch (type) {
    case "message": return { title: "Nuevo mensaje", body: "Tienes un mensaje nuevo.", data: { type, ...payload } };
    case "match": return { title: "¡Es un match!", body: "Habla con tu nuevo match.", data: { type, ...payload } };
    case "like": return { title: "Nuevo like", body: "Alguien te ha dado like.", data: { type, ...payload } };
    case "friend_request": return { title: "Solicitud", body: "Tienes una nueva solicitud.", data: { type, ...payload } };
    default: return { title: "Notificación", body: "Tienes una novedad.", data: { type: type || "general", ...payload } };
  }
}

async function processBatch(limit = 50) {
  const jobs = await claimNextJobs(limit);
  let sent = 0, failed = 0;
  for (const job of jobs) {
    try {
      // Optional server-side guard for message read state to avoid ghost notifications
      if (job.type === 'message') {
        try {
          const matchId = Number(job?.payload?.match_id);
          const messageId = Number(job?.payload?.message_id);
          if (Number.isFinite(matchId) && Number.isFinite(messageId)) {
            // Get message created_at
            const { data: msg, error: mErr } = await supabase
              .from('messages')
              .select('created_at')
              .eq('id', messageId)
              .maybeSingle();
            if (!mErr && msg?.created_at) {
              const createdAt = Date.parse(msg.created_at as any);
              // Get user's last_read_at for the match
              const { data: readRow, error: rErr } = await supabase
                .from('match_reads')
                .select('last_read_at')
                .eq('match_id', matchId)
                .eq('user_id', job.user_id)
                .maybeSingle();
              if (!rErr && readRow?.last_read_at) {
                const lastRead = Date.parse(readRow.last_read_at as any);
                // If already read when this job is being processed, skip sending
                if (!isNaN(lastRead) && !isNaN(createdAt) && lastRead >= createdAt) {
                  await supabase.from('notification_jobs').update({ status: 'sent', processed_at: new Date().toISOString(), last_error: null }).eq('id', job.id);
                  continue; // next job
                }
              }
              // Augment payload with created_at for client-side checks
              job.payload = { ...(job.payload || {}), created_at: msg.created_at };
            }
          }
        } catch (_) { /* ignore guard errors */ }
      }

      const tokens = await fetchUserTokens(job.user_id, job.type);
      if (!tokens.length) {
        // No tokens or preferences disabled -> mark sent (no-op) to avoid infinite retries
        await supabase.from("notification_jobs").update({ status: "sent", processed_at: new Date().toISOString() }).eq("id", job.id);
        continue;
      }
      const base = buildMessage(job.type, job.payload || {});
      // Use shorter TTL and collapse per thread for messages to reduce stale alerts
      const isMessage = job.type === 'message';
      const matchIdForCollapse = Number(job?.payload?.match_id);
      const collapseId = isMessage && Number.isFinite(matchIdForCollapse) ? `thread:${matchIdForCollapse}` : undefined;
      const ttl = isMessage ? 60 : 3600;
      const msgs = tokens.map((t) => ({
        to: t,
        sound: "default",
        channelId: "default",
        priority: "high",
        ttl,
        collapseId,
        ...base,
      }));
      for (const b of chunk(msgs, 99)) await sendExpo(b);
      await supabase.from("notification_jobs").update({ status: "sent", processed_at: new Date().toISOString() }).eq("id", job.id);
      sent += 1;
    } catch (e) {
      await supabase.from("notification_jobs").update({ status: "failed", last_error: String(e), processed_at: new Date().toISOString() }).eq("id", job.id);
      failed += 1;
    }
  }
  return { claimed: jobs.length, sent, failed };
}

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "authorization, content-type" } });
    if (req.method !== "POST") return json(405, { error: "Method not allowed" });

    const body = await req.json().catch(() => ({}));
  if (body?.debug) {
      const { data: pending, error: pErr } = await supabase
        .from("notification_jobs")
        .select("id, scheduled_at, status, type")
        .eq("status", "pending")
        .order("scheduled_at", { ascending: true, nullsFirst: true } as any)
        .limit(20);
      if (pErr) return json(500, { error: String(pErr) });
      return json(200, { pendingCount: (pending || []).length, sample: pending });
    }
    if (body?.debugClaim) {
      const picked = await claimNextJobs(Math.max(1, Math.min(10, Number(body?.limit) || 5)), true);
      return json(200, picked);
    }
    const limit = Math.max(1, Math.min(200, Number(body?.limit) || 50));
    const result = await processBatch(limit);
    return json(200, result);
  } catch (e) {
    return json(500, { error: String(e) });
  }
});
