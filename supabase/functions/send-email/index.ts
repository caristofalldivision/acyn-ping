import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  from?: string;
  userId: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured. Please add RESEND_API_KEY." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { to, subject, body, from, userId }: EmailRequest = await req.json();

    console.log(`Sending email to ${to} with subject: ${subject}`);

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
        message_type: "email",
        recipient: to,
        subject: subject,
        body: body,
        status: "pending",
      })
      .select()
      .single();

    if (logError) {
      console.error("Failed to log message:", logError);
    }

    // Send the email using Resend API directly
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: from || "Ping <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: `<div style="font-family: sans-serif; padding: 20px;">
          ${body.replace(/\n/g, "<br>")}
          <br><br>
          <p style="color: #666; font-size: 12px;">Sent via Ping Assistant</p>
        </div>`,
      }),
    });

    const emailResult = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);
      
      // Update log with failure
      if (logEntry) {
        await supabase
          .from("message_logs")
          .update({ status: "failed", error_message: emailResult.message || "Failed to send" })
          .eq("id", logEntry.id);
      }

      return new Response(
        JSON.stringify({ error: emailResult.message || "Failed to send email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Email sent successfully:", emailResult);

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
        message: `Email sent to ${to}`,
        messageId: emailResult.id 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
