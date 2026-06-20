import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Copy, Check, Trash2, Search, MessageSquare,
  FileText, Clock, Download, Plus, Save, RotateCcw, Send, Pencil
} from "lucide-react";

interface SavedScript {
  id: string;
  title: string;
  description: string | null;
  category: string;
  template_id: string | null;
  script_content: string;
  form_values: Record<string, string> | null;
  provider: string | null;
  placeholders: any;
  created_at: string;
  updated_at?: string;
}

interface SavedScriptsProps {
  onBack: () => void;
  onOpenInChat: (prompt: string) => void;
}

// Detects «TBD:label», {{label}}, or <TBD:label> tokens.
const PLACEHOLDER_RE = /«TBD:([^»]+)»|\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}|<TBD:([^>]+)>/g;

function extractPlaceholders(content: string): string[] {
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(content))) {
    const name = (m[1] || m[2] || m[3] || "").trim();
    if (name) found.add(name);
  }
  return Array.from(found);
}

function applyPlaceholders(content: string, values: Record<string, string>): string {
  return content.replace(PLACEHOLDER_RE, (_, a, b, c) => {
    const k = (a || b || c || "").trim();
    const val = values[k];
    // Prevent empty strings from breaking MikroTik syntax; revert to placeholder if empty
    return (val !== undefined && val.trim() !== "") ? val : `«TBD:${k}»`;
  });
}

// Utility to ensure MikroTik scripts execute correctly (requires trailing newline and CRLF)
function formatMikroTikScript(content: string): string {
  let cleanContent = content.replace(/\r?\n/g, "\r\n");
  if (!cleanContent.endsWith("\r\n")) {
    cleanContent += "\r\n";
  }
  return cleanContent;
}

export const SavedScripts = ({ onBack, onOpenInChat }: SavedScriptsProps) => {
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingDrafts, setEditingDrafts] = useState<Record<string, string>>({});
  const [placeholderVals, setPlaceholderVals] = useState<Record<string, Record<string, string>>>({});
  const [importOpen, setImportOpen] = useState(false);
  const [applyTarget, setApplyTarget] = useState<SavedScript | null>(null);
  const { toast } = useToast();

  useEffect(() => { loadScripts(); }, []);

  const loadScripts = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("saved_scripts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setScripts(data as SavedScript[]);
    setLoading(false);
  };

  const deleteScript = async (id: string) => {
    const { error } = await supabase.from("saved_scripts").delete().eq("id", id);
    if (!error) {
      setScripts(prev => prev.filter(s => s.id !== id));
      toast({ title: "Script deleted" });
    }
  };

  const copyScript = (content: string, id: string) => {
    const cleanContent = formatMikroTikScript(content);
    navigator.clipboard.writeText(cleanContent);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const downloadRsc = (script: SavedScript) => {
    const rawContent = editingDrafts[script.id] ?? script.script_content;
    const cleanContent = formatMikroTikScript(rawContent);
    const filename = script.title.replace(/[^a-zA-Z0-9_-]/g, "_") + ".rsc";
    
    // Explicit UTF-8 charset ensures special chars map to RouterOS correctly
    const blob = new Blob([cleanContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `${filename} ready for import` });
  };

  const saveEdit = async (script: SavedScript) => {
    const next = editingDrafts[script.id];
    if (next === undefined) return;
    const placeholders = extractPlaceholders(next);
    const { error } = await supabase.from("saved_scripts")
      .update({ script_content: next, placeholders } as any)
      .eq("id", script.id);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, script_content: next, placeholders } : s));
    setEditingDrafts(prev => { const n = { ...prev }; delete n[script.id]; return n; });
    toast({ title: "Saved" });
  };

  const applyPlaceholdersToDraft = (script: SavedScript) => {
    const vals = placeholderVals[script.id] || {};
    const cur = editingDrafts[script.id] ?? script.script_content;
    const next = applyPlaceholders(cur, vals);
    setEditingDrafts(prev => ({ ...prev, [script.id]: next }));
    toast({ title: "Placeholders filled" });
  };

  const categories = ["All", ...Array.from(new Set(scripts.map(s => s.category)))];

  const filtered = scripts.filter(s => {
    const matchSearch = !search || s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.script_content.toLowerCase().includes(search.toLowerCase());
    const matchCat = selectedCategory === "All" || s.category === selectedCategory;
    return matchSearch && matchCat;
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={onBack}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-foreground">Saved Scripts</h2>
            <p className="text-xs text-muted-foreground">{scripts.length} saved configuration{scripts.length !== 1 ? "s" : ""}</p>
          </div>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setImportOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Import provisioner
          </Button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search scripts..." className="pl-9 h-9 text-sm"
          />
        </div>
        {categories.length > 2 && (
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-1">
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}>
                  {cat}
                </button>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                {scripts.length === 0 ? "No saved scripts yet" : "No scripts match your search"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Generate a config script and click "Save", or import a third-party provisioner above.
              </p>
            </div>
          ) : (
            filtered.map(script => (
              <ScriptCard key={script.id}
                script={script}
                draft={editingDrafts[script.id]}
                placeholderVals={placeholderVals[script.id] || {}}
                copied={copiedId === script.id}
                expanded={expandedId === script.id}
                onToggleExpand={() => setExpandedId(expandedId === script.id ? null : script.id)}
                onDraftChange={v => setEditingDrafts(prev => ({ ...prev, [script.id]: v }))}
                onPlaceholderChange={(k, v) => setPlaceholderVals(prev => ({ ...prev, [script.id]: { ...(prev[script.id] || {}), [k]: v } }))}
                onApplyPlaceholders={() => applyPlaceholdersToDraft(script)}
                onSave={() => saveEdit(script)}
                onRevert={() => setEditingDrafts(prev => { const n = { ...prev }; delete n[script.id]; return n; })}
                onCopy={() => copyScript(editingDrafts[script.id] ?? script.script_content, script.id)}
                onDownload={() => downloadRsc(script)}
                onChat={() => onOpenInChat(editingDrafts[script.id] ?? script.script_content)}
                onDelete={() => deleteScript(script.id)}
                onApplyToDevice={() => setApplyTarget({ ...script, script_content: editingDrafts[script.id] ?? script.script_content })}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <ImportProvisionerDialog open={importOpen} onClose={() => setImportOpen(false)} onSaved={() => { setImportOpen(false); loadScripts(); }} />
      <ApplyToDeviceDialog target={applyTarget} onClose={() => setApplyTarget(null)} />
    </div>
  );
};

// ───────────────────────── Script card with inline editor ─────────────────────────
const ScriptCard = ({
  script, draft, placeholderVals, copied, expanded,
  onToggleExpand, onDraftChange, onPlaceholderChange, onApplyPlaceholders,
  onSave, onRevert, onCopy, onDownload, onChat, onDelete, onApplyToDevice,
}: {
  script: SavedScript;
  draft: string | undefined;
  placeholderVals: Record<string, string>;
  copied: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onDraftChange: (v: string) => void;
  onPlaceholderChange: (k: string, v: string) => void;
  onApplyPlaceholders: () => void;
  onSave: () => void;
  onRevert: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onChat: () => void;
  onDelete: () => void;
  onApplyToDevice: () => void;
}) => {
  const current = draft ?? script.script_content;
  const dirty = draft !== undefined && draft !== script.script_content;
  const placeholders = useMemo(() => extractPlaceholders(current), [current]);

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-foreground truncate">{script.title}</h3>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{script.category}</Badge>
            {script.provider && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{script.provider}</Badge>}
            {placeholders.length > 0 && <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-amber-500 border-amber-500/40">{placeholders.length} TBD</Badge>}
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(script.created_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {script.description && <p className="text-xs text-muted-foreground line-clamp-2">{script.description}</p>}

      <button onClick={onToggleExpand} className="text-xs text-primary hover:underline">
        {expanded ? "Hide script" : "Show & edit script"}
      </button>

      {expanded && (
        <div className="space-y-2">
          {placeholders.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 space-y-1.5">
              <p className="text-[11px] text-amber-500 font-medium">Fill placeholders</p>
              <div className="grid grid-cols-2 gap-1.5">
                {placeholders.map(name => (
                  <Input key={name} value={placeholderVals[name] || ""} onChange={e => onPlaceholderChange(name, e.target.value)} placeholder={name} className="h-7 text-xs font-mono" />
                ))}
              </div>
              <Button size="sm" variant="outline" className="h-6 text-[11px] gap-1" onClick={onApplyPlaceholders}>
                <Pencil className="w-3 h-3" /> Apply to script
              </Button>
            </div>
          )}

          <Textarea
            value={current}
            onChange={e => onDraftChange(e.target.value)}
            className="font-mono text-[11px] min-h-[180px] bg-secondary/50"
            spellCheck={false}
          />
          {dirty && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="default" className="h-7 text-xs gap-1.5" onClick={onSave}>
                <Save className="w-3 h-3" /> Save changes
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={onRevert}>
                <RotateCcw className="w-3 h-3" /> Revert
              </Button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onCopy}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onDownload}>
          <Download className="w-3 h-3" /> .rsc
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onApplyToDevice}>
          <Send className="w-3 h-3" /> Apply to device
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5" onClick={onChat}>
          <MessageSquare className="w-3 h-3" /> Chat
        </Button>
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
};

// ───────────────────────── Import provisioner dialog ─────────────────────────
const ImportProvisionerDialog = ({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) => {
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("centipid");
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    if (!title.trim() || !content.trim()) { toast({ title: "Title and script required", variant: "destructive" }); return; }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const placeholders = extractPlaceholders(content);
    const { error } = await supabase.from("saved_scripts").insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      category: "third-party",
      template_id: "external_provisioner",
      script_content: content,
      provider,
      placeholders,
    } as any);
    setSaving(false);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Provisioner imported" });
    setTitle(""); setDescription(""); setContent(""); setProvider("centipid");
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import third-party provisioner</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title (e.g. Centipid – PPPoE provisioner)" />
          <div className="grid grid-cols-2 gap-2">
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="centipid">Centipid</SelectItem>
                <SelectItem value="splynx">Splynx</SelectItem>
                <SelectItem value="mikrowisp">MikroWisp</SelectItem>
                <SelectItem value="radius-manager">RADIUS Manager</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" />
          </div>
          <Textarea value={content} onChange={e => setContent(e.target.value)} rows={14}
            placeholder="# Paste the full .rsc / provisioner script here.&#10;# Use «TBD:label» or {{label}} for fields the operator should fill in." className="font-mono text-xs" />
          <p className="text-[11px] text-muted-foreground">
            Tip: anywhere the provider's template uses a value the operator must edit, replace it with <code className="text-foreground">«TBD:label»</code> or <code className="text-foreground">{`{{label}}`}</code> — the editor will then surface a labelled input.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ───────────────────────── Apply-to-device dialog ─────────────────────────
const ApplyToDeviceDialog = ({ target, onClose }: { target: SavedScript | null; onClose: () => void }) => {
  const [devices, setDevices] = useState<{ id: string; name: string; agent_id: string | null }[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!target) return;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("devices" as any).select("id,name,agent_id").eq("user_id", user.id);
      setDevices((data as any) || []);
    })();
  }, [target]);

  const apply = async () => {
    if (!target || !selected) return;
    const dev = devices.find(d => d.id === selected);
    if (!dev?.agent_id) { toast({ title: "Selected device has no paired agent", variant: "destructive" }); return; }
    
    const remaining = extractPlaceholders(target.script_content);
    if (remaining.length > 0) {
      toast({ title: "Unfilled placeholders", description: `Fill these first: ${remaining.join(", ")}`, variant: "destructive" });
      return;
    }

    setSending(true);

    // Normalize for API execution
    let cleanScript = target.script_content.replace(/\r?\n/g, "\n");
    if (!cleanScript.endsWith("\n")) {
      cleanScript += "\n";
    }

    const { data, error } = await supabase.functions.invoke("device-jobs", {
      body: { device_id: selected, kind: "apply_script", script_content: cleanScript },
    });
    
    setSending(false);
    if (error || !data?.job_id) { toast({ title: "Failed to enqueue", description: error?.message, variant: "destructive" }); return; }
    if (data.warning) toast({ title: "Agent offline", description: data.warning, variant: "destructive" });
    else toast({ title: "Queued for agent", description: `Job ${String(data.job_id).slice(0, 8)}…` });
    onClose();
  };

  return (
    <Dialog open={!!target} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Apply script to device</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Sends "{target?.title}" to the selected router via its paired agent. The job runs as <code>apply_script</code>.
          </p>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Pick a router…" /></SelectTrigger>
            <SelectContent>
              {devices.map(d => (
                <SelectItem key={d.id} value={d.id} disabled={!d.agent_id}>
                  {d.name}{!d.agent_id ? " (no agent)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={apply} disabled={!selected || sending}>{sending ? "Sending…" : "Apply"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
