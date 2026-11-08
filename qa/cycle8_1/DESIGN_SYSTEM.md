# Syncly Design System Specifications

**Version:** 1.0 (Cycle 8.1)  
**Target Archetype:** Modern Corporate SaaS / Enterprise Communication Hub  
**Theme Support:** Dark Mode First (Slate & Zinc Precision) with High Contrast Accents  

---

## 1. Color Palette & Semantic Tokens

### 1.1 Base & Surface Colors
| Token Name | Hex Code | Tailwind Equivalent | Semantic Usage |
| :--- | :--- | :--- | :--- |
| `--surface-canvas` | `#090D16` | `bg-slate-950` / `bg-zinc-950` | Primary application viewport canvas |
| `--surface-card` | `#0F172A` | `bg-slate-900` | Post cards, modal content, navigation cards |
| `--surface-elevated` | `#1E293B` | `bg-slate-800` | Dropdowns, tooltips, popovers, hovering cards |
| `--surface-sunken` | `#0B1120` | `bg-slate-950/60` | Input backgrounds, code blocks, quote containers |
| `--border-subtle` | `rgba(255, 255, 255, 0.08)` | `border-slate-800` / `border-zinc-800` | Card borders, dividers, list separators |
| `--border-interactive` | `rgba(255, 255, 255, 0.16)` | `border-slate-700` | Input borders, selectable items, buttons |

### 1.2 Brand & Interactive Colors
| Token Name | Hex Code | Tailwind Equivalent | Semantic Usage |
| :--- | :--- | :--- | :--- |
| `--primary-600` | `#4F46E5` | `bg-indigo-600` | Primary action buttons, active tab indicators |
| `--primary-500` | `#6366F1` | `text-indigo-400`, `bg-indigo-500` | Focus rings, interactive link hovers |
| `--primary-700` | `#4338CA` | `bg-indigo-700` | Primary button hover / active press state |
| `--accent-teal` | `#0D9488` | `text-teal-400`, `bg-teal-500/10` | Verified badges, online presence indicators |
| `--accent-rose` | `#F43F5E` | `text-rose-500`, `bg-rose-500/10` | Post like / heart reactions, critical alerts |

### 1.3 Text & Typography Contrast Tokens
| Token Name | Hex Code | Contrast Ratio on Slate-950 | Semantic Usage |
| :--- | :--- | :---: | :--- |
| `--text-primary` | `#F8FAFC` (`slate-50`) | **16.8:1** (Passes AAA) | Primary headings, post body text, author names |
| `--text-secondary` | `#94A3B8` (`slate-400`) | **7.4:1** (Passes AAA) | Timestamps, subtitles, secondary metadata |
| `--text-muted` | `#64748B` (`slate-500`) | **4.6:1** (Passes AA) | Helper labels, placeholder text, disclaimers |
| `--text-link` | `#818CF8` (`indigo-400`) | **7.1:1** (Passes AAA) | Interactive links and inline action buttons |

---

## 2. Typography Hierarchy

- **Font Family (Display & UI)**: `'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Font Family (Monospace & Code)**: `'JetBrains Mono', ui-monospace, Menlo, Monaco, Consolas, monospace`

| Scale | Size (px / rem) | Line Height | Weight | Usage |
| :--- | :--- | :--- | :--- | :--- |
| **Hero** | 32px / 2.0rem | 1.25 | Bold (700) | Landing headers, auth welcome headers |
| **H1** | 24px / 1.5rem | 1.3 | Bold (700) | Screen page titles (Feed, Explore, Chat) |
| **H2** | 18px / 1.125rem | 1.4 | SemiBold (600) | Card titles, section headers, modal headers |
| **Body (Default)** | 14px / 0.875rem | 1.5 | Regular (400) | Post content, chat messages, input values |
| **Caption / Meta** | 12px / 0.75rem | 1.4 | Medium (500) | Timestamps, channel names, role badges, pills |

---

## 3. Component Specs & Interaction Guidelines

### 3.1 Buttons
- **Primary Button**: `bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-xl transition-all shadow-sm hover:shadow-indigo-500/20 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-400 min-h-[44px]`
- **Secondary Button**: `bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium px-4 py-2 rounded-xl transition-all active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-slate-400 min-h-[44px]`
- **Ghost / Icon Button**: `p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-400 min-w-[44px] min-h-[44px] flex items-center justify-center`

### 3.2 Form Inputs
- **Base Input**: `w-full bg-slate-900/90 border border-slate-700/80 hover:border-slate-600 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-slate-100 placeholder:text-slate-500 rounded-xl px-3.5 py-2.5 text-sm transition-all outline-hidden min-h-[44px]`
- **Password Input with Visibility Toggle**: Wrapped input container featuring an absolute-positioned `44x44px` icon button toggling `type="password"` vs `type="text"`.

### 3.3 Cards & Surface Elevation
- **Standard Card**: `bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:border-slate-700/80`
- **Modal Dialog**: `bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md max-w-lg w-full p-6 text-slate-100`

---

## 4. Responsive Breakpoints

| Breakpoint | Minimum Width | Layout Behaviors |
| :--- | :--- | :--- |
| **Mobile XS** | 320px | Single column, compressed padding (`px-3`), full-width forms, icon-only buttons |
| **Mobile Standard** | 375px – 430px | Single column, standard padding (`px-4`), bottom navigation visible |
| **Tablet** | 768px | 2-column community explorer, sidebar visible, bottom nav hides if sidebar active |
| **Desktop** | 1024px – 1440px | 3-column feed (Nav + Stream + Right Sidebar), expanded chat sidebar |
