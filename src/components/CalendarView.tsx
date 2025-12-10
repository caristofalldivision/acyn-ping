import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, Clock, MapPin, Users, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay } from "date-fns";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  location: string | null;
  event_type: string;
  attendees: string[] | null;
}

export const CalendarView = () => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("calendar_events")
        .select("*")
        .eq("user_id", user.id)
        .order("start_time", { ascending: true });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setLoading(false);
    }
  };

  const eventsOnSelectedDate = events.filter((event) =>
    selectedDate && isSameDay(new Date(event.start_time), selectedDate)
  );

  const datesWithEvents = events.map((event) => new Date(event.start_time));

  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "meeting": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "reminder": return "bg-amber-500/20 text-amber-400 border-amber-500/30";
      case "deadline": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-primary/20 text-primary border-primary/30";
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
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className="rounded-md border border-border/50"
            modifiers={{
              hasEvent: datesWithEvents,
            }}
            modifiersStyles={{
              hasEvent: {
                fontWeight: "bold",
                textDecoration: "underline",
                textUnderlineOffset: "4px",
              },
            }}
          />
          <p className="text-xs text-muted-foreground mt-3 text-center">
            Ask Topha to schedule events: "Schedule a meeting tomorrow at 3pm"
          </p>
        </CardContent>
      </Card>

      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {eventsOnSelectedDate.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <CalendarDays className="h-12 w-12 mb-3 opacity-50" />
                <p className="text-sm">No events scheduled</p>
                <p className="text-xs mt-1">
                  Ask Topha to create one
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {eventsOnSelectedDate.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-lg bg-muted/30 border border-border/50 space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <h4 className="font-medium text-foreground">{event.title}</h4>
                      <Badge className={getEventTypeColor(event.event_type)}>
                        {event.event_type}
                      </Badge>
                    </div>
                    
                    {event.description && (
                      <p className="text-sm text-muted-foreground">{event.description}</p>
                    )}

                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {format(new Date(event.start_time), "h:mm a")}
                        {event.end_time && ` - ${format(new Date(event.end_time), "h:mm a")}`}
                      </span>
                      
                      {event.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </span>
                      )}
                      
                      {event.attendees && event.attendees.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {event.attendees.length} attendee(s)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
