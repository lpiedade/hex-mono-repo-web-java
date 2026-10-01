/**
 * The failure vocabulary every subdomain shares: an {@link ApplicationProblem} classified by
 * its {@link ProblemKind}, the {@link ProblemException} every domain refusal extends, and
 * {@link UniqueConstraintViolation}, which a port declares instead of a vendor's
 * duplicate-key exception. Mapping a kind to a status or an exit code is the inbound
 * adapter's job, never this package's.
 */
package com.example.app.domain.error;
