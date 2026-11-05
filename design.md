# JobViệt design system

## Direction

JobViệt is a Vietnamese job search and hiring product for candidates and employers. Its primary tasks are finding a suitable role and reviewing applicants. The visual direction is an editorial job index: measured typography, clear ruled divisions, restrained surfaces, and the existing JobViệt teal used for actions and selected states.

## Tokens

- Theme basis: Hallmark Studio, adapted to preserve the existing JobViệt teal.
- Display face: Hedvig Letters Serif with Georgia fallback.
- Interface face: Geist with the existing system sans fallback.
- Canvas: cool paper, ink text, quiet rules, flat surfaces.
- Accent: existing JobViệt teal (`--primary`); no gradients or ornamental glow.
- App screens keep their current navigation and content structure. Density and alignment do the visual work.

## Components and behavior

- Public job pages, account pages, and candidate/employer dashboard pages use `css/pages/hallmark.css` as their final visual layer.
- Preserve every route, form field, element ID, script, handler, API call, sidebar destination, and chat behavior.
- Keep content and product facts as currently written. Do not add fabricated metrics, logos, testimonials, or photos.

## Responsive and accessible behavior

- Keep the existing mobile navigation and sidebar behavior.
- Preserve keyboard focus visibility, native disabled states, and reduced-motion preferences.
- Job listings and dashboard tables remain readable on narrow screens.
