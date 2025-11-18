import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { MessageSquarePlus, Trash2, Edit2, Check, X, Archive } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
  is_archived: boolean;
}

interface ConversationListProps {
  activeConversationId: string | null;
  onConversationSelect: (id: string) => void;
  onNewConversation: () => void;
}

export const ConversationList = ({
  activeConversationId,
  onConversationSelect,
  onNewConversation,
}: ConversationListProps) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conversationToDelete, setConversationToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("updated_at", { ascending: false });

    if (!error && data) {
      setConversations(data);
    }
  };

  const startEdit = (conversation: Conversation) => {
    setEditingId(conversation.id);
    setEditTitle(conversation.title);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveEdit = async (id: string) => {
    if (!editTitle.trim()) {
      cancelEdit();
      return;
    }

    const { error } = await supabase
      .from("conversations")
      .update({ title: editTitle.trim() })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update conversation title",
        variant: "destructive",
      });
    } else {
      await loadConversations();
      cancelEdit();
    }
  };

  const confirmDelete = (id: string) => {
    setConversationToDelete(id);
    setDeleteDialogOpen(true);
  };

  const deleteConversation = async () => {
    if (!conversationToDelete) return;

    const { error } = await supabase
      .from("conversations")
      .delete()
      .eq("id", conversationToDelete);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to delete conversation",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Deleted",
        description: "Conversation deleted successfully",
      });
      await loadConversations();
      if (conversationToDelete === activeConversationId) {
        onNewConversation();
      }
    }
    setDeleteDialogOpen(false);
    setConversationToDelete(null);
  };

  const archiveConversation = async (id: string) => {
    const { error } = await supabase
      .from("conversations")
      .update({ is_archived: true })
      .eq("id", id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to archive conversation",
        variant: "destructive",
      });
    } else {
      await loadConversations();
      if (id === activeConversationId) {
        onNewConversation();
      }
    }
  };

  return (
    <>
      <Card className="h-full flex flex-col bg-transparent border-none shadow-none">
        <div className="p-4 border-b border-border/30">
          <Button
            onClick={onNewConversation}
            className="w-full rounded-2xl"
            variant="gradient"
            size="sm"
          >
            <MessageSquarePlus className="w-4 h-4 mr-2" />
            New Chat
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group relative rounded-2xl p-4 cursor-pointer transition-all ${
                activeConversationId === conv.id
                  ? "bg-gradient-to-r from-gradient-start to-gradient-end text-white shadow-lg shadow-glow-primary/20"
                  : "bg-card/50 hover:bg-card/80 backdrop-blur-sm border border-border/30"
              }`}
              onClick={() => onConversationSelect(conv.id)}
            >
              {editingId === conv.id ? (
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && saveEdit(conv.id)}
                    className="h-8 text-sm rounded-xl bg-input/50 border-border/30"
                    autoFocus
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-xl"
                    onClick={() => saveEdit(conv.id)}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 rounded-xl"
                    onClick={cancelEdit}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <div className={`text-sm font-medium truncate pr-20 ${
                    activeConversationId === conv.id ? "text-white" : "text-foreground"
                  }`}>
                    {conv.title}
                  </div>
                  <div className={`text-xs mt-1 ${
                    activeConversationId === conv.id ? "text-white/70" : "text-muted-foreground"
                  }`}>
                    {new Date(conv.updated_at).toLocaleDateString()}
                  </div>
                  <div
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 flex gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 rounded-xl ${activeConversationId === conv.id ? "hover:bg-white/20 text-white" : ""}`}
                      onClick={() => startEdit(conv)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 rounded-xl ${activeConversationId === conv.id ? "hover:bg-white/20 text-white" : ""}`}
                      onClick={() => archiveConversation(conv.id)}
                    >
                      <Archive className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 rounded-xl text-destructive ${activeConversationId === conv.id ? "hover:bg-white/20" : ""}`}
                      onClick={() => confirmDelete(conv.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={deleteConversation}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
