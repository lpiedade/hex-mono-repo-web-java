/**
 * The portal's backend-for-frontend (ADR-009): the one origin the browser calls. It
 * authenticates the browser and relays its calls to the application API, and does not
 * aggregate, reshape or validate them — the API stays the authority for every rule. It
 * persists nothing, serves no SPA asset (ADR-017), and depends on neither {@code core} nor
 * the API at runtime.
 */
package com.example.app.portal;
