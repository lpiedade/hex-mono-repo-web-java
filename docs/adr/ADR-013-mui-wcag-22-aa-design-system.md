# ADR-013: Material UI with a WCAG 2.2 AA design-system target

- Status: Accepted
- Date: Template baseline
- Related: [ADR-009](ADR-009-react-typescript-and-spring-bff.md), [ADR-014](ADR-014-real-service-browser-acceptance.md)

## Context

The portal needs consistent forms, tables, navigation, dialogs, and status
displays. Building each primitive independently multiplies cost and makes
accessibility vary from screen to screen. Automated accessibility scanners help,
but they cannot prove keyboard operation, focus management, reflow,
screen-reader output, or whether an interface is understandable.

## Decision

Use Material UI (MUI 5) as the component foundation, under an application-owned
theme: tokens, typography, shape, status vocabulary, and composed patterns live
in the SPA's theme module, not in individual screens. Use semantic HTML before
custom ARIA. WCAG 2.2 AA is the delivery target for every shipped journey.

Every page has:

- semantic landmarks, a page title, and a heading structure;
- a skip link, full keyboard operation, and visible focus;
- accessible dialogs that trap and restore focus;
- an error summary, with help and errors associated to their fields;
- status conveyed by text and glyph, never by colour alone;
- support for 200 percent zoom and reflow, and respect for reduced motion.

Charts, if any, have a textual or tabular alternative. Virtualized lists are
allowed only when they preserve semantics and focus; otherwise use pagination.

User-facing strings go through an internationalization layer (i18next).
Technical identifiers, enum values, and data values are not localized.

Colour values are design tokens, and contrast is a gate on them: normal-size
text and controls meet AA contrast in every theme the portal ships. A token pair
that fails is changed, not waived.

Acceptance combines component tests, automated axe checks against the
production bundle in a real browser
([ADR-014](ADR-014-real-service-browser-acceptance.md)), keyboard-only
journeys, and manual contrast, reflow, and screen-reader review. Passing the
tools is evidence, not certification, and known limitations are published as
such.

## Rationale

MUI provides maintained, accessible primitives suited to data-heavy internal
applications, and its theming lets the application own its visual vocabulary
without forking components. Putting that vocabulary in one theme module keeps
screens consistent and makes a contrast or focus fix a single change. Mixing
automated and manual evidence covers what code scanning cannot observe.

## Alternatives considered

### Build every component from scratch — rejected

It adds broad maintenance and accessibility risk for no product value.

### Treat a clean axe run as acceptance — rejected

It cannot validate keyboard flow, focus order, or what a screen reader
announces.

### Fixed-width desktop layout — rejected

Zoom and reflow are accessibility requirements, and narrow windows are common
even on desktops.

### Full mobile / offline (PWA) support — rejected

No use case needs offline or native-mobile behaviour; responsive layout covers
narrow screens.

## Consequences

### Positive

- Consistent, accessible primitives and one visual vocabulary.
- Theming and localization have explicit foundations from the start.
- Accessibility is tested across complete journeys, not only per component.

### Negative

- MUI adds to bundle size, which needs watching.
- Custom compositions can still introduce accessibility defects.
- Manual accessibility review is recurring effort.
