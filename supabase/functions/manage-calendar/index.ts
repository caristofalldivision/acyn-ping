import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CalendarRequest {
  action: "create" | "list" | "update" | "delete";
  userId: string;
  event?: {
    id?: string;
    title?: string;
    description?: string;
    start_time?: string;
    end_time?: string;
    location?: string;
    event_type?: string;
    reminder_minutes?: number;
    attendees?: string[];
  };
  days?: number;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, userId, event, days = 7 }: CalendarRequest = await req.json();

    console.log(`Calendar action: ${action} for user: ${userId}`);

    switch (action) {
      case "create": {
        if (!event?.title || !event?.start_time) {
          return new Response(
            JSON.stringify({ error: "Title and start_time are required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase
          .from("calendar_events")
          .insert({
            user_id: userId,
            title: event.title,
            description: event.description,
            start_time: event.start_time,
            end_time: event.end_time || new Date(new Date(event.start_time).getTime() + 60 * 60 * 1000).toISOString(),
            location: event.location,
            event_type: event.event_type || "meeting",
            reminder_minutes: event.reminder_minutes || 30,
            attendees: event.attendees || [],
          })
          .select()
          .single();

        if (error) throw error;

        console.log("Event created:", data);

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Event "${event.title}" scheduled for ${new Date(event.start_time).toLocaleString()}`,
            event: data 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "list": {
        const now = new Date();
        const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

        const { data, error } = await supabase
          .from("calendar_events")
          .select("*")
          .eq("user_id", userId)
          .gte("start_time", now.toISOString())
          .lte("start_time", endDate.toISOString())
          .order("start_time", { ascending: true });

        if (error) throw error;

        console.log(`Found ${data?.length || 0} events`);

        return new Response(
          JSON.stringify({ 
            success: true, 
            events: data || [],
            message: data?.length 
              ? `You have ${data.length} event(s) in the next ${days} days`
              : `No events scheduled for the next ${days} days`
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update": {
        if (!event?.id) {
          return new Response(
            JSON.stringify({ error: "Event ID is required for update" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateData: any = {};
        if (event.title) updateData.title = event.title;
        if (event.description !== undefined) updateData.description = event.description;
        if (event.start_time) updateData.start_time = event.start_time;
        if (event.end_time) updateData.end_time = event.end_time;
        if (event.location !== undefined) updateData.location = event.location;
        if (event.attendees) updateData.attendees = event.attendees;

        const { data, error } = await supabase
          .from("calendar_events")
          .update(updateData)
          .eq("id", event.id)
          .eq("user_id", userId)
          .select()
          .single();

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: `Event updated successfully`,
            event: data 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete": {
        if (!event?.id) {
          return new Response(
            JSON.stringify({ error: "Event ID is required for deletion" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("calendar_events")
          .delete()
          .eq("id", event.id)
          .eq("user_id", userId);

        if (error) throw error;

        return new Response(
          JSON.stringify({ 
            success: true, 
            message: "Event deleted successfully" 
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

  } catch (error: any) {
    console.error("Calendar error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Calendar operation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
