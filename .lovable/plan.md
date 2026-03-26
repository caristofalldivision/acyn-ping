

# .RSC Export, New Portal Themes & Full Responsiveness

## Changes

### 1. SavedScripts.tsx - Add .rsc download button
- Add a "Download .rsc" button next to Copy/Open in Chat for each saved script
- Uses the existing `DownloadButton` pattern: creates a Blob with the script content, triggers download as `{title}.rsc` (sanitized filename)
- Add `Download` icon from lucide-react
- Make the action buttons wrap properly on small screens using `flex-wrap`

### 2. CaptivePortalBuilder.tsx - Add 3 new theme presets + responsiveness

**New theme presets** (applied as one-click configs that set all colors + layout):
- **🎮 Dark Gaming** - Deep purple/black bg (#0a0015), neon green accent (#00ff88), card with subtle glow border, minimal layout
- **🏢 Corporate Clean** - White/light gray bg (#f8fafc), navy primary (#1e3a5f), clean centered layout, professional typography  
- **☕ Cafe/Restaurant** - Warm brown bg (#2c1810), orange accent (#f97316), cream text, cozy centered layout with warm tones

**Theme selector** added to the Brand tab as a row of clickable preset cards with emoji + name, placed before the ISP name input. Clicking a preset fills all color/layout fields at once but keeps user's ISP name and payment settings.

**Add download HTML button** in the footer alongside Copy and Save - downloads as `login.html`.

**Responsiveness fixes:**
- Tab triggers: reduce to icons-only on screens < 400px using responsive classes
- Preview iframe: use `aspect-ratio: 9/16` on mobile instead of fixed 400px height
- Footer buttons: stack vertically on very small screens
- Color picker grid: single column on xs screens

### 3. SavedScripts.tsx - Responsiveness fixes
- Action buttons: use `flex-wrap gap-1.5` so they wrap on narrow screens
- Script card padding: reduce to `p-3` on mobile
- Search input and category pills: already responsive, no changes needed

### 4. CaptivePortalBuilder.tsx - Download .html button
- Add a third button in the footer: "Download HTML" that triggers a blob download of the generated HTML as `login.html`

## Files Modified
| File | Change |
|------|--------|
| `src/components/SavedScripts.tsx` | Add .rsc download button per script, responsive button wrapping |
| `src/components/CaptivePortalBuilder.tsx` | Add 3 theme presets (gaming/corporate/cafe), download HTML button, responsive fixes |

