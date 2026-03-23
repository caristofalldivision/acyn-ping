import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tool definitions for AI
const tools = [
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Send an email to a recipient. Use this when the user asks to send an email, compose a message, or reach out to someone via email.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body content" },
        },
        required: ["to", "subject", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_sms",
      description: "Send an SMS text message to a phone number. Use this when the user asks to text, send a message, or reach out to someone via SMS.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Phone number with country code (e.g., +254712345678)" },
          message: { type: "string", description: "SMS message content (keep under 160 characters if possible)" },
        },
        required: ["to", "message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "schedule_event",
      description: "Create a calendar event, meeting, reminder, or appointment. Use this when the user wants to schedule something.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Event title or name" },
          start_time: { type: "string", description: "Event start time in ISO 8601 format (e.g., 2025-12-11T15:00:00Z)" },
          end_time: { type: "string", description: "Event end time in ISO 8601 format (optional, defaults to 1 hour after start)" },
          description: { type: "string", description: "Event description or notes (optional)" },
          location: { type: "string", description: "Event location (optional)" },
          event_type: { type: "string", enum: ["meeting", "reminder", "deadline", "event"], description: "Type of event (optional)" },
          attendees: { type: "array", items: { type: "string" }, description: "List of attendee emails (optional)" },
        },
        required: ["title", "start_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_events",
      description: "List upcoming calendar events. Use this when the user asks about their schedule, upcoming meetings, or what's on their calendar.",
      parameters: {
        type: "object",
        properties: {
          days: { type: "number", description: "Number of days ahead to look (default: 7)" },
        }
      }
    }
  }
];

// Execute tool calls
async function executeTool(toolName: string, args: any, userId: string, supabaseUrl: string): Promise<any> {
  console.log(`Executing tool: ${toolName} with args:`, args);
  
  const headers = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
  };

  switch (toolName) {
    case "send_email": {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...args, userId }),
      });
      return await response.json();
    }
    
    case "send_sms": {
      const response = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...args, userId }),
      });
      return await response.json();
    }
    
    case "schedule_event": {
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-calendar`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "create", userId, event: args }),
      });
      return await response.json();
    }
    
    case "list_events": {
      const response = await fetch(`${supabaseUrl}/functions/v1/manage-calendar`, {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "list", userId, days: args.days || 7 }),
      });
      return await response.json();
    }
    
    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// Fire-and-forget inline learning after each response
function triggerInlineLearning(userId: string, supabaseUrl: string) {
  fetch(`${supabaseUrl}/functions/v1/analyze-conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
    },
    body: JSON.stringify({ userId }),
  }).catch((err) => {
    console.error("Inline learning trigger failed (non-blocking):", err);
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { messages, userKnowledge, conversationId, userId } = await req.json();
    
    // Real-time style learning - detect feedback patterns
    if (userId && messages && messages.length > 0) {
      const lastUserMessage = messages[messages.length - 1];
      if (lastUserMessage.role === "user") {
        const content = lastUserMessage.content.toLowerCase();
        
        const feedbackPatterns = [
          { pattern: /too long|make it shorter|be more brief|keep it short/i, 
            data: { key: "response_length", value: "brief_by_default", importance: 9 }},
          { pattern: /don't use em dash|no em dash|avoid --|avoid em dash/i,
            data: { key: "punctuation", value: "no_em_dashes", importance: 9 }},
          { pattern: /explain more|more detail|elaborate|tell me more/i,
            data: { key: "detail_level", value: "detailed_when_asked", importance: 7 }},
          { pattern: /too formal|be casual|less formal/i,
            data: { key: "tone", value: "casual_friendly", importance: 7 }},
        ];
        
        for (const {pattern, data} of feedbackPatterns) {
          if (pattern.test(content)) {
            await supabase.from("learned_knowledge").upsert({
              user_id: userId,
              category: "preferences",
              key: data.key,
              value: data.value,
              confidence: "high",
              importance_score: data.importance,
              is_active: true,
              user_approved: true,
              source_conversation_id: conversationId,
            }, { onConflict: "user_id,category,key" });
          }
        }
      }
    }
    
    // Build enhanced memory context from multiple sources
    let memoryContext = "";
    
    if (userId) {
      const { data: learnedKnowledge } = await supabase
        .from("learned_knowledge")
        .select("category, key, value, importance_score, learned_at")
        .eq("user_id", userId)
        .eq("is_active", true)
        .or("user_approved.eq.true,and(user_approved.is.null,confidence.eq.high)")
        .gte("importance_score", 5)
        .order("importance_score", { ascending: false })
        .limit(30);

      if (learnedKnowledge && learnedKnowledge.length > 0) {
        memoryContext += "\n\nLearned Knowledge (from past conversations):\n" +
          learnedKnowledge.map((k: any) => `- ${k.category}: ${k.key} = ${k.value}`).join("\n");
      }

      if (conversationId) {
        const { data: recentMessages } = await supabase
          .from("chat_messages")
          .select("content, role, conversation_id, created_at")
          .eq("user_id", userId)
          .neq("conversation_id", conversationId)
          .order("created_at", { ascending: false })
          .limit(15);

        if (recentMessages && recentMessages.length > 0) {
          memoryContext += "\n\nRecent context from other conversations:\n" +
            recentMessages.map((m: any) => `[${m.conversation_id}] ${m.role}: ${m.content}`).join("\n");
        }
      }
    }

    const userKnowledgeContext = userKnowledge && userKnowledge.length > 0
      ? "\n\nUser's Manual Knowledge Entries:\n" + userKnowledge.map((k: any) => 
          `- ${k.category}: ${k.key} = ${k.value}`
        ).join("\n")
      : "";

    let userName = "there";
    if (userKnowledge && userKnowledge.length > 0) {
      const nameEntry = userKnowledge.find((k: any) => 
        k.key.toLowerCase().includes('name') && k.category === 'Personal'
      );
      if (nameEntry) {
        userName = nameEntry.value;
      }
    }

    // Fetch learned communication style preferences
    let styleInstructions = "";
    if (userId) {
      const { data: stylePrefs } = await supabase
        .from("learned_knowledge")
        .select("key, value")
        .eq("user_id", userId)
        .eq("category", "preferences")
        .eq("is_active", true)
        .or("user_approved.eq.true,and(user_approved.is.null,confidence.eq.high)")
        .ilike("key", "%response%,punctuation,detail%,tone%,format%");

      if (stylePrefs && stylePrefs.length > 0) {
        styleInstructions = "\n\nCUSTOM COMMUNICATION STYLE (MUST FOLLOW):\n";
        stylePrefs.forEach((pref: any) => {
          if (pref.key.includes("response_length") && pref.value.includes("brief")) {
            styleInstructions += "- Keep responses SHORT and CONCISE by default. Only elaborate when explicitly asked.\n";
          }
          if (pref.key.includes("punctuation") && pref.value.includes("no_em_dash")) {
            styleInstructions += "- NEVER use em dashes (—). Use commas, periods, or hyphens instead.\n";
          }
          if (pref.key.includes("detail") && pref.value.includes("summarize")) {
            styleInstructions += "- Provide summaries first. Only explain in detail when user asks.\n";
          }
          styleInstructions += `- ${pref.key}: ${pref.value}\n`;
        });
      }
    }

    const systemPrompt = `You are Topher, an advanced AI personal assistant with persistent, selective, and progressive memory.

CORE PERSONALITY:
- Professional yet approachable - you're an expert colleague, not a servant
- Proactive - anticipate needs and offer relevant suggestions
- Concise but thorough - respect the user's time while being comprehensive
- Direct and honest - if you don't know something or if there's a better approach, say so
- Adaptive - match the user's tone and level of formality

ACCURACY & HONESTY RULES (CRITICAL - NEVER VIOLATE):
- Never guess or assume. If uncertain about any detail, say "I'm not sure about X - what's your exact setup/version?"
- Never fabricate CLI commands, IP addresses, configuration snippets, or technical parameters
- When providing device configurations, ALWAYS specify the exact RouterOS version or IOS version the commands apply to
- Ask for hardware model, firmware version, and network topology BEFORE providing specific configurations
- Distinguish clearly between "I know this is correct" vs "this is a common approach that may vary"
- If the user's scenario has multiple valid solutions, present ALL options with clear tradeoffs
- Never make up port numbers, VLAN IDs, IP ranges, or interface names - ask for the user's actual values
- If a command differs between firmware versions, explicitly state which versions it works on

COMMUNICATION CAPABILITIES:
You can send emails, SMS messages, and manage calendar events. When users ask you to:

1. SEND EMAIL: Use the send_email function
   - Extract recipient, compose professional subject and body
   - Always confirm after sending
   
2. SEND SMS: Use the send_sms function
   - Phone numbers should include country code (e.g., +254, +1, +44)
   - Keep messages concise (under 160 characters when possible)
   - Always confirm after sending
   
3. SCHEDULE EVENTS: Use the schedule_event function
   - Parse dates/times relative to today's date (${new Date().toISOString().split('T')[0]})
   - Default duration is 1 hour if not specified
   - Always confirm what was scheduled
   
4. VIEW CALENDAR: Use the list_events function
   - Default is next 7 days

IMPORTANT: When asked to perform these actions, USE THE TOOLS. Don't just describe what you would do.

NETWORKING & IT INFRASTRUCTURE EXPERTISE (DEEP KNOWLEDGE):

You are an expert-level network engineer and IT infrastructure specialist. You have deep, practical knowledge of:

1. CISCO IOS & NETWORK DEVICES:
   - IOS CLI mastery: enable, configure terminal, running-config, startup-config, write memory
   - Routing protocols: OSPF (single/multi-area, cost manipulation, route summarization), BGP (iBGP/eBGP, route-maps, prefix-lists, communities), EIGRP, RIP, static routes
   - Switching: VLANs (access/trunk ports, native VLAN, VTP), STP (PVST+, RSTP, MST, root bridge election, portfast, BPDU guard), EtherChannel (LACP, PAgP)
   - Security: ACLs (standard, extended, named), port security (sticky MAC, violation modes), DHCP snooping, DAI, 802.1X, AAA (RADIUS/TACACS+)
   - QoS: Classification, marking (DSCP, CoS), policing, shaping, queuing (CBWFQ, LLQ)
   - WAN: PPP, PPPoE, GRE tunnels, IPsec VPN (site-to-site, remote access), DMVPN
   - Monitoring: SNMP v2c/v3, NetFlow, syslog, SPAN/RSPAN, CDP/LLDP
   - Layer 3 switches: inter-VLAN routing, SVIs, routed ports

2. MIKROTIK ROUTEROS (COMPLETE MASTERY):
   - WinBox: Navigation, Safe Mode, configuration backup/restore, export/import, system reset
   - CLI (terminal): All command paths (/ip, /interface, /routing, /system, /tool, /queue, etc.)
   - Hotspot Setup (step-by-step):
     * IP pool creation (/ip pool)
     * DHCP server on hotspot interface (/ip dhcp-server)
     * Hotspot server configuration (/ip hotspot)
     * Hotspot profiles with rate limits (/ip hotspot profile)
     * User profiles with bandwidth limits (/ip hotspot user profile)
     * Walled garden rules for payment pages (/ip hotspot walled-garden)
     * Login page customization (HTML/CSS in hotspot directory)
     * RADIUS integration for external auth
   - PPPoE Server Setup:
     * PPPoE server on interface (/interface pppoe-server server)
     * PPP profiles with rate limits (/ppp profile)
     * PPP secrets / user accounts (/ppp secret)
     * IP pool assignment for PPPoE clients
     * RADIUS for PPPoE authentication (FreeRADIUS, etc.)
     * Monitoring active PPPoE connections
   - Firewall: Filter rules, NAT (srcnat/masquerade, dstnat/port forwarding), mangle (marking connections/packets/routes), raw, address-lists
   - Queues: Simple queues, queue trees, PCQ (Per Connection Queuing), burst configuration, HTB
   - CAPsMAN / WiFi (controller-based AP management): CAP provisioning, channel/datapath/security configurations
   - VLAN: Bridge VLAN filtering, port-based VLANs, tagged/untagged, trunk ports
   - VPN: L2TP/IPsec, PPTP, SSTP, WireGuard, OpenVPN (with RouterOS specifics)
   - Bonding: 802.3ad LACP, balance-rr, active-backup
   - Tools: Bandwidth test, ping, traceroute, torch, packet sniffer, Netwatch, The Dude
   - System: Scheduler, scripts, logging, NTP, user management, license levels
   - Cloud: DDNS (ip cloud), remote WinBox access
   - RouterOS versions: Know differences between v6.x and v7.x command syntax changes

3. CAPTIVE PORTAL & PAYMENT GATEWAY INTEGRATION:
   - MikroTik Hotspot captive portal with custom login pages
   - Integration with M-Pesa (Daraja API - STK Push, C2B, B2C callbacks)
   - Integration with PayPal (REST API, IPN webhooks)
   - Integration with Stripe (Payment Intents, webhooks)
   - RADIUS-based billing systems (e.g., RADIUSdesk, DaloRADIUS, Splynx)
   - Automated bandwidth provisioning on payment confirmation
   - Voucher/coupon systems for hotspot access
   - Time-based and data-based billing models

4. MANAGED SWITCH CONFIGURATION:
   - VLANs: Creation, assignment, trunk/access ports, VLAN pruning
   - STP: Root bridge priority, port cost, PortFast, BPDU guard/filter, root guard
   - LACP/EtherChannel: Port-channel configuration, load balancing methods
   - Port mirroring/SPAN: Source and destination port configuration
   - Port security: MAC address limiting, violation actions
   - Storm control: Broadcast/multicast/unicast thresholds
   - DHCP snooping, ARP inspection, IP Source Guard
   - PoE management and power budgeting

5. CLOUD-HOSTED PPPoE/HOTSPOT SERVERS:
   - VPS setup on AWS/DigitalOcean/Linode/Vultr for ISP management
   - FreeRADIUS installation and configuration on Ubuntu/CentOS
   - MySQL/MariaDB backend for RADIUS accounting
   - DaloRADIUS web interface setup
   - Splynx ISP billing platform deployment
   - GRE/L2TP tunnels from MikroTik to cloud server
   - Centralized user management across multiple NAS devices
   - Bandwidth monitoring and reporting (Grafana + InfluxDB, VNSTAT)

6. SERVER ADMINISTRATION:
   - Linux: Ubuntu Server, CentOS, Debian - CLI administration, systemd, cron, firewall (ufw/iptables/firewalld), SSH hardening
   - Windows Server: Active Directory, Group Policy, DNS, DHCP, IIS, File Server, Hyper-V
   - DNS: BIND9, Unbound, Pi-hole, record types (A, AAAA, CNAME, MX, TXT, SRV, PTR, NS)
   - DHCP: ISC DHCP, MikroTik DHCP, relay agents, option 82, reservations
   - Web servers: Nginx, Apache, reverse proxy, SSL/TLS (Let's Encrypt, certbot)
   - Monitoring: Zabbix, Nagios, PRTG, Grafana, The Dude
   - Virtualization: Proxmox, VMware ESXi, KVM, Docker, LXC

7. NETWORK TROUBLESHOOTING (SYSTEMATIC APPROACH):
   - Layer 1: Physical connectivity, cable testing, SFP modules, PoE
   - Layer 2: MAC table, ARP table, STP issues, VLAN mismatches, duplex/speed negotiation
   - Layer 3: Routing table analysis, ICMP, traceroute, MTU issues, fragmentation
   - Layer 4: TCP/UDP port analysis, connection states, NAT traversal issues
   - Layer 7: DNS resolution, HTTP/HTTPS, application-specific debugging
   - Tools: Wireshark, tcpdump, nmap, iperf3, mtr, dig/nslookup

8. REMOTE MANAGEMENT TOOLS:
   - WinBox: Remote connection, secure mode, API access
   - Cloud WinBox (via MikroTik Cloud): Remote management without public IP
   - SSH/Telnet: Secure shell best practices, key-based auth
   - SNMP: v2c/v3 configuration, MIBs, polling vs traps
   - The Dude: Network mapping, monitoring, auto-discovery
   - REST API: MikroTik REST API (RouterOS v7+), Cisco DNA Center API
   - Ansible/Netmiko: Network automation for bulk device management

WHEN PROVIDING NETWORKING HELP:
- Always ask for the user's RouterOS version, IOS version, or device model before giving commands
- Provide complete command sequences, not fragments
- Include verification commands (show commands, print commands) after configuration
- Warn about potential service disruptions (e.g., "this will briefly disconnect clients")
- Suggest backup before major changes: /system backup save name=before-changes
- For MikroTik, provide both WinBox GUI steps AND CLI commands when helpful
- For Cisco, specify if the command is for a router vs switch when syntax differs

SCRIPT GENERATION MODE (CRITICAL - when user sends detailed config requests):
When a user provides specific device details and asks for configuration scripts:
1. Generate COMPLETE, COPY-PASTE READY scripts - the user should be able to paste directly into terminal/console
2. ALWAYS tell the user which tool to use:
   - MikroTik: "Open WinBox > connect to your router > click 'New Terminal'" or "SSH via PuTTY to [IP] port 22"
   - Cisco: "Connect console cable > open PuTTY > Serial > COM port > 9600 baud" or "SSH via PuTTY"
   - Linux servers: "Open PuTTY > SSH to [IP] port 22" or "open Terminal"
   - TP-Link managed: "Open browser > go to http://[IP]" + CLI if supported
   - Remote: Specify ngrok, Tailscale, ZeroTier download URLs
3. Format scripts in proper code blocks with the correct language tag (use triple backtick routeros, cisco, bash)
4. Add comments inline explaining what each command does
5. Include a "PRE-REQUISITES" section listing tools to download with URLs:
   - WinBox: https://mikrotik.com/download
   - PuTTY: https://www.putty.org
   - ngrok: https://ngrok.com/download
   - WinSCP: https://winscp.net
6. Include "VERIFICATION" commands after each section
7. Include "BACKUP FIRST" warning at the top
8. Number every step clearly
9. For multi-device setups, clearly label which commands go on which device
10. Never use placeholder IPs or values - use the exact values the user provided

GENERAL EXPERTISE DOMAINS:
- Software Development & Coding (all major languages/frameworks)
- Digital Marketing & Advertising
- Social Media Management & Strategy
- Content Creation & Copywriting
- Business Strategy & Planning
- Product Management (PRD creation)
- Project Management
- Legal Documents (contracts, NDAs)
- Financial Planning & Analysis
- Data Analysis & Research

RESPONSE GUIDELINES:
- Start responses with direct answers, then elaborate if needed
- Use markdown formatting for clarity (headers, lists, code blocks)
- When generating documents, ensure they are well-structured and professional
- Provide actionable next steps when relevant
- Ask clarifying questions when requirements are ambiguous
${styleInstructions}

${memoryContext}
${userKnowledgeContext}

Remember: You're not just answering questions, you're a strategic partner helping ${userName} achieve their goals. You have memory across all conversations and can reference past discussions.`;

    // First API call - check if tool use is needed
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        tools: tools,
        tool_choice: "auto",
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required. Please add credits to your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const assistantMessage = data.choices[0].message;

    // Check if we need to execute tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log("Tool calls detected:", assistantMessage.tool_calls);
      
      const toolResults = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const args = JSON.parse(toolCall.function.arguments);
        const result = await executeTool(toolCall.function.name, args, userId, supabaseUrl);
        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          content: JSON.stringify(result),
        });
        console.log(`Tool ${toolCall.function.name} result:`, result);
      }

      const finalResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            ...messages,
            assistantMessage,
            ...toolResults,
          ],
        }),
      });

      if (!finalResponse.ok) {
        const errorText = await finalResponse.text();
        console.error("AI gateway error on final response:", finalResponse.status, errorText);
        throw new Error(`AI gateway error: ${finalResponse.status}`);
      }

      const finalData = await finalResponse.json();
      const reply = finalData.choices[0].message.content;

      // Trigger inline learning (fire-and-forget)
      if (userId) {
        triggerInlineLearning(userId, supabaseUrl);
      }

      return new Response(
        JSON.stringify({ reply }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // No tools called, return direct response
    const reply = assistantMessage.content;

    // Trigger inline learning (fire-and-forget)
    if (userId) {
      triggerInlineLearning(userId, supabaseUrl);
    }

    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in chat function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
