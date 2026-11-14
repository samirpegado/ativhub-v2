"use client";

import { useEffect, useRef, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OpenWorkOrderReportButton({
  workOrderId,
  className,
}: {
  workOrderId: string;
  className?: string;
}) {
  const [opening, setOpening] = useState(false);
  const watchRef = useRef<number | null>(null);

  function finish() {
    if (watchRef.current != null) {
      window.clearInterval(watchRef.current);
      watchRef.current = null;
    }
    setOpening(false);
  }

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; id?: string } | null;
      if (data?.type === "work-order-print-ready" && data.id === workOrderId) finish();
    }
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (watchRef.current != null) window.clearInterval(watchRef.current);
    };
  }, [workOrderId]);

  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={opening}
      aria-busy={opening}
      onClick={() => {
        if (opening) return;
        setOpening(true);
        const popup = window.open(`/work-orders/${workOrderId}/print`, "_blank");
        if (!popup) {
          finish();
          return;
        }
        watchRef.current = window.setInterval(() => {
          if (popup.closed) finish();
        }, 400);
      }}
    >
      {opening ? <Loader2 className="animate-spin" /> : <FileText />}
      Relatório PDF
    </Button>
  );
}
