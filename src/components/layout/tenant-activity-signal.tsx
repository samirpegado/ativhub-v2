"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type TenantActivityIdentity = {
  userId: string;
  tenantId: string;
  membershipId: string;
};

const accessIntervalMs = 5 * 60_000;
const retryIntervalMs = 30_000;
const waitingUntil = new Map<string, number>();
const inFlight = new Set<string>();

function inCooldown(until: number | undefined, now: number) {
  return until !== undefined && until > now && until - now <= accessIntervalMs;
}

async function recordAccess({ userId, tenantId, membershipId }: TenantActivityIdentity) {
  const key = `ativhub:last-tenant-access:${membershipId}`;
  const now = Date.now();
  if (inFlight.has(key) || inCooldown(waitingUntil.get(key), now)) return;

  try {
    const until = Number(window.localStorage.getItem(key));
    if (inCooldown(until, now)) {
      waitingUntil.set(key, until);
      return;
    }
  } catch {
    // In-memory throttling still works without browser storage.
  }

  inFlight.add(key);
  waitingUntil.set(key, now + retryIntervalMs);
  try {
    const supabase = createClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || session?.user.id !== userId || session.user.app_metadata?.tenant_id !== tenantId) return;
    if (document.visibilityState !== "visible") return;

    const { error } = await supabase.rpc("record_membership_access");
    if (error) return;

    const until = Date.now() + accessIntervalMs;
    waitingUntil.set(key, until);
    window.localStorage.setItem(key, String(until));
  } catch {
    // Recording a visit must not interrupt the operational screen.
  } finally {
    inFlight.delete(key);
  }
}

export function TenantActivitySignal({ userId, tenantId, membershipId }: TenantActivityIdentity) {
  useEffect(() => {
    function track(event?: Event) {
      if (document.visibilityState !== "visible" || (event && !event.isTrusted)) return;
      void recordAccess({ userId, tenantId, membershipId });
    }

    track();
    document.addEventListener("visibilitychange", track);
    document.addEventListener("pointerdown", track, { capture: true, passive: true });
    document.addEventListener("click", track, true);
    document.addEventListener("keydown", track, true);
    document.addEventListener("wheel", track, { capture: true, passive: true });
    return () => {
      document.removeEventListener("visibilitychange", track);
      document.removeEventListener("pointerdown", track, true);
      document.removeEventListener("click", track, true);
      document.removeEventListener("keydown", track, true);
      document.removeEventListener("wheel", track, true);
    };
  }, [userId, tenantId, membershipId]);

  return null;
}
