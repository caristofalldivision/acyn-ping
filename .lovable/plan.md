

# Saved Scripts + Captive Portal Template Builder

## Overview

Two new features:
1. **Saved Scripts** - Users can save generated configurations to their account and access/manage them later
2. **Captive Portal Builder** - Visual editor where users customize a hotspot login page (logo, colors, payment buttons) and get the complete HTML/CSS to deploy

## Database Changes

### New table: `saved_scripts`
```sql
CREATE TABLE saved_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  template_id TEXT,
  script_content TEXT NOT NULL,
  form_values JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
-- RLS: users CRUD their own scripts only
```

No new table needed for captive portal builder - it generates HTML on the client side that users can copy or save as a script.

## File Changes

### 1. `src/components/ScriptGenerator.tsx`
- Add a "Save Script" button after generation that saves the prompt + response to `saved_scripts`
- Add a "Saved Scripts" tab/button at the top of the script generator view
- Show saved scripts list with copy, delete, and re-generate actions

### 2. `src/components/SavedScripts.tsx` (NEW)
- List of user's saved scripts grouped by category
- Each script card shows: title, category, date, preview
- Actions: copy full script, delete, open in chat (re-send prompt)
- Search/filter by category
- Empty state with helpful message

### 3. `src/components/CaptivePortalBuilder.tsx` (NEW)
Visual editor with live preview:
- **Branding section**: ISP name input, logo upload URL, tagline
- **Colors section**: Background color, primary button color, text color, accent color (color pickers)
- **Payment buttons**: Toggle M-Pesa, Stripe, PayPal, Voucher code - each adds a styled button to the portal
- **Layout options**: Select from 2-3 layout styles (centered card, full-screen split, minimal)
- **Live preview**: Real-time HTML preview in an iframe showing exactly what the captive portal will look like
- **Export**: "Copy HTML" button gives the complete HTML/CSS file ready to upload to MikroTik hotspot directory
- **Save**: Save the portal config as a saved script for later access

The generated HTML will be a complete, self-contained file with inline CSS - no external dependencies - ready to be uploaded as `login.html` to a MikroTik's hotspot directory via WinBox Files.

### 4. `src/components/ChatInterface.tsx`
- Add suggestion chip for "Captive Portal Builder" that opens the builder
- Update `__OPEN_SCRIPTS__` flow: add "Saved" tab alongside generator
- After AI generates a script response, show a "Save this script" button on the message

### 5. `src/pages/Index.tsx`
- No major changes - captive portal builder and saved scripts are accessed through the chat interface / script generator

## Technical Details

| File | Action |
|------|--------|
| `saved_scripts` table | CREATE via migration + RLS policies |
| `src/components/SavedScripts.tsx` | NEW - saved scripts list UI |
| `src/components/CaptivePortalBuilder.tsx` | NEW - visual portal editor with live preview |
| `src/components/ScriptGenerator.tsx` | ADD saved scripts tab + save button |
| `src/components/ChatInterface.tsx` | ADD captive portal suggestion chip + save script button on messages |

### Captive Portal HTML Output Structure
The builder generates a complete MikroTik-compatible `login.html` with:
- MikroTik hotspot variables (`$(link-login-only)`, `$(link-status)`, etc.)
- Responsive CSS (works on phones)
- Payment button sections with walled garden instructions
- Custom branding (colors, logo, ISP name)
- Login form with username/password or voucher code field

