import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, MessageSquare, Loader2, CheckCircle, XCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface MessageLog {
  id: string;
  message_type: string;
  recipient: string;
  subject: string | null;
  body: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
}

export const MessageHistory = () => {
  const [messages, setMessages] = useState<MessageLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "email" | "sms">("all");

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("message_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error("Error fetching messages:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMessages = messages.filter((msg) =>
    filter === "all" ? true : msg.message_type === filter
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-amber-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "failed":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
        <TabsList className="bg-muted/50">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1">
            <Mail className="h-3 w-3" />
            Emails
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            SMS
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-4">
          <ScrollArea className="h-[400px]">
            {filteredMessages.length === 0 ? (
              <Card className="bg-card/50 border-border/50">
                <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  {filter === "email" ? (
                    <Mail className="h-12 w-12 mb-3 opacity-50" />
                  ) : filter === "sms" ? (
                    <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                  ) : (
                    <MessageSquare className="h-12 w-12 mb-3 opacity-50" />
                  )}
                  <p className="text-sm">No messages sent yet</p>
                  <p className="text-xs mt-1">
                    Ask Topha to send an email or SMS
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredMessages.map((msg) => (
                  <Card key={msg.id} className="bg-card/50 border-border/50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {msg.message_type === "email" ? (
                            <Mail className="h-4 w-4 text-blue-400" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-green-400" />
                          )}
                          <span className="font-medium text-sm">{msg.recipient}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(msg.status)}
                          <Badge className={getStatusBadge(msg.status)}>
                            {msg.status}
                          </Badge>
                        </div>
                      </div>

                      {msg.subject && (
                        <p className="text-sm font-medium mb-1">{msg.subject}</p>
                      )}

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {msg.body}
                      </p>

                      {msg.error_message && (
                        <p className="text-xs text-red-400 mt-2">
                          Error: {msg.error_message}
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-2">
                        {msg.sent_at 
                          ? `Sent ${format(new Date(msg.sent_at), "MMM d, yyyy 'at' h:mm a")}`
                          : `Created ${format(new Date(msg.created_at), "MMM d, yyyy 'at' h:mm a")}`
                        }
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
};
