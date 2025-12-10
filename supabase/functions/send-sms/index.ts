import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SmsRequest {
  to: string;
  message: string;
  userId: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const atApiKey = Deno.env.get("AT_API_KEY");
    const atUsername = Deno.env.get("AT_USERNAME");
    
    if (!atApiKey || !atUsername) {
      console.error("Africa's Talking credentials not configured");
      return new Response(
        JSON.stringify({ error: "SMS service not configured. Please add AT_API_KEY and AT_USERNAME." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, message, userId }: SmsRequest = await req.json();

    console.log(`Sending SMS to ${to}: ${message.substring(0, 50)}...`);

    // Initialize Supabase client for logging
    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log the message attempt
    const { data: logEntry, error: logError } = await supabase
      .from("message_logs")
      .insert({
        user_id: userId,
        message_type: "sms",
        recipient: to,
        body: message,
        status: "pending",
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to log message:", logError);
    }

    // Format phone number (ensure it starts with +)
    const formattedPhone = to.startsWith("+") ? to : `+${to}`;

    // Africa's Talking API call
    const atSenderId = Deno.env.get("AT_SENDER_ID");
    
    // Determine API endpoint (sandbox vs production)
    const isSandbox = atUsername.toLowerCase() === "sandbox";
    const apiUrl = isSandbox
      ? "https://api.sandbox.africastalking.com/version1/messaging"
      : "https://api.africastalking.com/version1/messaging";

    const formData = new URLSearchParams();
    formData.append("username", atUsername);
    formData.append("to", formattedPhone);
    formData.append("message", message);
    if (atSenderId) {
      formData.append("from", atSenderId);
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "apiKey": atApiKey,
      },
      body: formData.toString(),
    });

    const result = await response.json();
    console.log("Africa's Talking response:", result);

    if (result.SMSMessageData?.Recipients?.[0]?.status === "Success" || 
        result.SMSMessageData?.Recipients?.[0]?.statusCode === 101) {
      // Update log with success
      if (logEntry) {
        await supabase
          .from("message_logs")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", logEntry.id);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `SMS sent to ${formattedPhone}`,
          details: result.SMSMessageData
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } else {
      // Update log with failure
      const errorMsg = result.SMSMessageData?.Recipients?.[0]?.status || "Unknown error";
      if (logEntry) {
        await supabase
          .from("message_logs")
          .update({ status: "failed", error_message: errorMsg })
          .eq("id", logEntry.id);
      }

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: errorMsg,
          details: result
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

  } catch (error: any) {
    console.error("Error sending SMS:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send SMS" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
