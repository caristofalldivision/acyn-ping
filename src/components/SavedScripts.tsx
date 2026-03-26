import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Copy, Check, Trash2, Search, MessageSquare,
  FileText, Clock, Download
} from "lucide-react";

interface SavedScript {
  id: string;
  title: string;
  description: string | null;
  category: string;
  template_id: string | null;
  script_content: string;
  form_values: Record<string, string> | null;
  created_at: string;
}

interface SavedScriptsProps {
  onBack: () => void;
  onOpenInChat: (prompt: string) => void;
}

export const SavedScripts = ({ onBack, onOpenInChat }: SavedScriptsProps) => {
  const [scripts, setScripts] = useState<SavedScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadScripts();
  }, []);

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
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: "Copied to clipboard" });
  };

  const downloadRsc = (script: SavedScript) => {
    const filename = script.title.replace(/[^a-zA-Z0-9_-]/g, "_") + ".rsc";
    const blob = new Blob([script.script_content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Downloaded", description: `${filename} ready for import` });
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
          <div>
            <h2 className="text-lg font-semibold text-foreground">Saved Scripts</h2>
            <p className="text-xs text-muted-foreground">{scripts.length} saved configuration{scripts.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search scripts..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        {categories.length > 2 && (
          <ScrollArea className="w-full">
            <div className="flex gap-2 pb-1">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
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
                Generate a config script and click "Save" to keep it here
              </p>
            </div>
          ) : (
            filtered.map(script => (
              <div
                key={script.id}
                className="rounded-xl border border-border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm text-foreground truncate">{script.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{script.category}</Badge>
                      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(script.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {script.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{script.description}</p>
                )}

                <button
                  onClick={() => setExpandedId(expandedId === script.id ? null : script.id)}
                  className="text-xs text-primary hover:underline"
                >
                  {expandedId === script.id ? "Hide script" : "Show script"}
                </button>

                {expandedId === script.id && (
                  <pre className="text-xs bg-secondary/50 rounded-lg p-3 overflow-x-auto max-h-60 whitespace-pre-wrap text-foreground/80">
                    {script.script_content}
                  </pre>
                )}

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => copyScript(script.script_content, script.id)}
                  >
                    {copiedId === script.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedId === script.id ? "Copied" : "Copy"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => downloadRsc(script)}
                  >
                    <Download className="w-3 h-3" />
                    .rsc
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => onOpenInChat(script.script_content)}
                  >
                    <MessageSquare className="w-3 h-3" />
                    Chat
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => deleteScript(script.id)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
