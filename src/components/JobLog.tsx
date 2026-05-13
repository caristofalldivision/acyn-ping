import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface JobLogProps {
  jobId: string;
  onClose?: () => void;
}

export const JobLog = ({ jobId, onClose }: JobLogProps) => {
  const [log, setLog] = useState("");
  const [status, setStatus] = useState("pending");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("device_jobs" as any).select("output_log, status, error").eq("id", jobId).single();
      if (cancelled || !data) return;
      setLog((data as any).output_log || "");
      setStatus((data as any).status);
      setError((data as any).error);
    };
    load();
    const channel = supabase.channel(`job-${jobId}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "device_jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          const n = payload.new as any;
          setLog(n.output_log || "");
          setStatus(n.status);
          setError(n.error);
        })
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [jobId]);

  const isTerminal = ["success", "failed", "rolled_back"].includes(status);
  const statusColor = status === "success" ? "text-green-500"
    : status === "failed" ? "text-destructive"
    : status === "rolled_back" ? "text-yellow-500"
    : "text-primary";

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-background/50">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono uppercase ${statusColor}`}>{status}</span>
          {!isTerminal && (
            <div className="flex gap-0.5">
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "150ms" }} />
              <div className="w-1 h-1 rounded-full bg-primary animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
          )}
        </div>
        {onClose && <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>}
      </div>
      <pre className="text-[11px] font-mono p-3 overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap">
        {log || "Waiting for agent…"}
      </pre>
      {error && (
        <div className="px-3 py-2 border-t border-border bg-destructive/10 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
};
