# Design System Document: The Construct-Flow Framework

## 1. Overview & Creative North Star
**Creative North Star: The Architectural Pulse**
This design system moves away from the "industrial clunkiness" often associated with construction software. Instead, it adopts the fluidity of modern communication (inspired by Telegram) and elevates it through **Architectural Sophistication**. We treat the mobile interface not as a static grid, but as a dynamic blueprint—precise, layered, and breathable.

By utilizing intentional asymmetry and high-contrast typography, we create an editorial-grade experience. We break the "template" look by favoring **Tonal Depth** over lines and **Spatial Rhythm** over rigid boxes. The result is a high-performance tool that feels as premium as the structures our users build.

---

## 2. Colors: Tonal Architecture
Our palette centers on the authoritative `primary` (#006193) while using a sophisticated range of greys to define space.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders to section off content. Boundaries must be defined solely through background color shifts or subtle tonal transitions.
*   *Implementation:* Place a `surface-container-low` section against a `surface` background to define a zone.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—stacked sheets of frosted glass or fine architectural paper.
*   **Base:** `surface` (#f9f9f9)
*   **Elevated Zones:** Use `surface-container-low` (#f3f3f3) for subtle grouping.
*   **High-Priority Cards:** Use `surface-container-lowest` (#ffffff) to make elements pop forward.

### The "Glass & Gradient" Rule
To avoid a flat, "out-of-the-box" appearance:
*   **Floating Elements:** Use `surface_tint` at 10% opacity with a `backdrop-filter: blur(20px)` for overlays.
*   **Signature Textures:** Apply a subtle linear gradient (from `primary` to `primary_container`) on main CTAs to provide a "soul" and professional luster that flat hex codes lack.

---

## 3. Typography: The Editorial Scale
We use a dual-font strategy to balance character with utility.

*   **Display & Headlines (Manrope):** This is our "Architectural" voice. Use `display-lg` through `headline-sm` to create a bold, editorial rhythm. The wider tracking of Manrope feels authoritative and modern.
*   **Body & Labels (Inter):** This is our "Precision" voice. Inter’s high x-height ensures maximum readability for technical construction data and fast-paced chat logs.

**Hierarchy Tip:** Use `title-lg` (Inter) for immediate action items, but use `headline-md` (Manrope) for section titles to maintain the high-end editorial feel.

---

## 4. Elevation & Depth: Tonal Layering
We do not build with "shadows"; we build with "light and atmosphere."

*   **The Layering Principle:** Achieve depth by stacking tiers. An inbox item (chat bubble) should be `surface-container-lowest` (#ffffff) sitting on a `surface-container` (#eeeeee) background.
*   **Ambient Shadows:** When a floating action button (FAB) or modal requires a shadow, use a `12px 24px` blur at 6% opacity, tinted with `on-surface` (#1a1c1c). Never use pure black shadows.
*   **The "Ghost Border" Fallback:** If accessibility requires a stroke (e.g., in high-glare outdoor construction environments), use `outline-variant` (#bfc7d2) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Chat Bubbles (The Communication Core)
*   **Outgoing:** Use `primary_container` (#007bb9) with `on_primary` text. Use the `md` (1.5rem) corner radius, but "pinch" the bottom-right corner to `sm` (0.5rem) to indicate origin.
*   **Incoming:** Use `surface_container_highest` (#e2e2e2) with `on_surface` text. Use the `md` corner radius, "pinched" at the bottom-left.
*   **Note:** No borders. Use `body-lg` for text to ensure readability on-site.

### Input Fields & Attachments
*   **Structure:** A "pill" shape using `surface_container_lowest` (#ffffff).
*   **The Attachment Trigger:** A simple, high-contrast icon using the `tertiary` (#8b4c00) color to make it stand out as a secondary action.
*   **States:** On focus, do not change the border. Instead, shift the background to `surface_bright` and add a subtle `primary` ambient glow.

### Bottom Navigation Bar
*   **Style:** A glassmorphic bar (`surface` at 80% opacity + blur).
*   **Interaction:** Active icons should use the `primary` color with a small `tertiary` dot underneath to signify the current state, avoiding bulky "active" background boxes.

### Cards & Lists
*   **Constraint:** **Forbid the use of divider lines.**
*   **Separation:** Use vertical white space (24px - 32px) and `surface_container_low` backgrounds to differentiate construction project cards.

### Construction-Specific Component: "Status Chips"
*   **Draft/Pending:** `secondary_container` with `on_secondary_container`.
*   **Urgent/Blocked:** `error_container` (#ffdad6) with `on_error_container` (#93000a).
*   **Shape:** Always `full` (9999px) roundedness for a friendly, "bubble" feel.

---

## 6. Do's and Don'ts

### Do
*   **Do** use extreme roundedness (`xl`: 3rem) for large containers to soften the technical nature of the app.
*   **Do** use `tertiary` (#8b4c00) for "Attention" items like safety alerts or past-due milestones—it provides a sophisticated alternative to "Warning Yellow."
*   **Do** embrace white space. If a screen feels crowded, increase the `surface` padding rather than adding a box.

### Don't
*   **Don't** use pure #000000 for text. Use `on_surface` (#1a1c1c) for a more natural, high-end ink look.
*   **Don't** use 1px dividers between chat messages. Let the bubble shapes and time-stamps (`label-sm`) create the separation.
*   **Don't** use standard "system" blue. Always use the specified `primary` (#006193) to maintain the signature Construction-meets-Telegram identity.