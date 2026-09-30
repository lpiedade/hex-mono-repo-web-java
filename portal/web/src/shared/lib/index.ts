/**
 * Public API of `shared/lib` — small helpers with no knowledge of the product:
 * the page-state vocabulary, the visually-hidden style, and the document-title
 * hooks every route relies on (WCAG 2.4.2).
 */
export { PAGE_STATES, pageStateOf, type PageState } from "./pageState";
export { useDocumentTitle, useRouteTitle, type RouteHandle } from "./useDocumentTitle";
export { visuallyHidden } from "./visuallyHidden";
