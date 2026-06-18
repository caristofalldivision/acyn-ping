// Lightweight RouterOS script linter. Pure TypeScript, no deps.
// Catches the most common foot-guns BEFORE we send a script to a live router.

export interface RosLintResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  normalized: string;
}

const FORBIDDEN = [
  { pattern: /\/system\s+reset-configuration\b/i, msg: "Never include /system reset-configuration — user runs that manually." },
  { pattern: /\/system\s+backup\s+save\b/i, msg: "Do not run /system backup save inside agent scripts." },
  { pattern: /\/system\s+shutdown\b/i, msg: "Do not include /system shutdown." },
  { pattern: /\/system\s+reboot\b/i, msg: "Do not include /system reboot unless the user explicitly asked." },
];

const DANGEROUS = [
  { pattern: /\/ip\s+address\s+remove\b/i, msg: "/ip address remove without :do {} on-error={} can lock you out." },
  { pattern: /\/interface\s+disable\s+ether1\b/i, msg: "Disabling ether1 will drop the management link on most boards." },
  { pattern: /\/ip\s+route\s+remove\b/i, msg: "/ip route remove without on-error guard can drop the default route." },
  { pattern: /\/user\s+remove\b/i, msg: "Removing a user without an on-error guard can lock you out." },
];

export function lintRouterOSScript(input: string): RosLintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!input || typeof input !== "string") {
    return { ok: false, errors: ["Empty script"], warnings: [], normalized: "" };
  }
  // Strip markdown fences if model returned them.
  const stripped = input
    .replace(/^\s*```(?:routeros|rsc|ros|mikrotik)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const lines = stripped.split(/\r?\n/);
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line || line.startsWith("#")) { out.push(raw); continue; }

    // Commands must start with / or : or be a continuation
    if (!/^[\/:]/.test(line) && !/^(add|set|remove|enable|disable|print|find)\b/i.test(line)) {
      errors.push(`Line ${i + 1}: not a RouterOS command: "${line.slice(0, 80)}"`);
    }
    if (line.length > 4096) {
      errors.push(`Line ${i + 1}: exceeds 4096 chars.`);
    }
    // Quote balance
    const quoteCount = (line.match(/(?<!\\)"/g) || []).length;
    if (quoteCount % 2 !== 0) {
      errors.push(`Line ${i + 1}: unbalanced double quotes.`);
    }
    // Unescaped $ outside of valid script variable contexts
    if (/(?<!\\)\$[^\w({[]/.test(line)) {
      warnings.push(`Line ${i + 1}: bare $ — escape with \\$ if it's literal.`);
    }

    for (const f of FORBIDDEN) {
      if (f.pattern.test(line)) errors.push(`Line ${i + 1}: ${f.msg}`);
    }
    for (const d of DANGEROUS) {
      if (d.pattern.test(line) && !/:do\s*\{/.test(line)) {
        warnings.push(`Line ${i + 1}: ${d.msg}`);
      }
    }
    out.push(raw);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized: out.join("\n").trim() + "\n",
  };
}
