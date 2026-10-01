/**
 * The BFF's HTTP surface: the proxy from {@code /app/bff/v1} to the API's {@code /api/v1},
 * its own {@code /app/health} and {@code /app/about}, the envelope and access-log filters
 * every response passes, and the Problem Details shape of every failure the BFF answers
 * itself ({@link BffProblem}).
 */
package com.example.app.portal.web;
