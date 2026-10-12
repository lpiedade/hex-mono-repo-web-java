/**
 * Public API of `shared/lib` — small helpers with no knowledge of the product:
 * the page-state vocabulary, the visually-hidden style, the document-title
 * hooks every route relies on (WCAG 2.4.2), and the router's future flags.
 */
export { PAGE_STATES, pageStateOf, type PageState } from "./pageState";
export { RENDER_FUTURE, ROUTER_FUTURE } from "./routerFuture";
export { useDocumentTitle, useRouteTitle, type RouteHandle } from "./useDocumentTitle";
export { visuallyHidden } from "./visuallyHidden";
