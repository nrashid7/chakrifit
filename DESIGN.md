# Design

## Direction

ChakriFit uses a trust-first premium product language inspired by Linear and Stripe: crisp surfaces, strong hierarchy, restrained color, and clear state feedback. The interface should feel credible enough for eligibility decisions while remaining warmer than an official portal.

## Color

- Background: pale green-white, with subtle depth instead of heavy gradients.
- Ink: deep green-black for text and high-contrast controls.
- Primary: teal-green for primary actions, selected navigation, focus rings, and eligibility highlights.
- Semantic colors: green for eligible/success, amber for partial/review, red for destructive actions.
- Avoid purple, saturated blue gradients, beige craft palettes, and decorative color changes between sections.

## Typography

- Display and brand: Plus Jakarta Sans.
- Product UI: system sans stack for readability and performance.
- Landing headings may use fluid sizing; authenticated app screens use fixed rem scales.
- Body text stays at 1rem or above with line lengths capped around 65 to 75 characters.

## Shape And Surface

- Controls: 8px radius.
- Panels and list rows: 12px radius.
- Pills and circles are reserved for status, avatars, language controls, and score marks.
- Use cards only for discrete actionable objects. Prefer dividers, bands, and spacing for grouping.

## Components

- Page headers combine a short badge, title, description, and optional actions.
- Metric tiles use tabular numbers, small labels, and semantic accents.
- Job and match rows prioritize status, deadline, organization, score, official circular, and save action.
- Empty states should include one useful next action.
- Upload zones must make privacy, file type, and progress states obvious.

## Motion

Motion is subtle and functional. Buttons press down in 100 to 160ms. Popovers, dialogs, and filters use 150 to 250ms transitions. Loading uses skeletons where possible. Respect `prefers-reduced-motion` and never gate content visibility behind animation.

## Implementation Notes

Keep backend contracts, route paths, server functions, and Supabase schema unchanged. Favor existing Tailwind v4 utilities, shadcn/Radix components, and lucide icons. Do not add a new UI framework for this redesign.
