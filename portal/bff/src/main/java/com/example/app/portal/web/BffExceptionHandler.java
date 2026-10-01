package com.example.app.portal.web;

import com.example.app.portal.config.PortalProperties;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.ErrorResponse;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Every failure the BFF itself answers is a {@link BffProblem}, like the ones it raises on
 * purpose — never Spring Boot's default error body, which has another shape and no
 * {@code code} for the SPA to branch on.
 *
 * <ul>
 *   <li>An unmapped path is a 404 {@code NOT_FOUND}.</li>
 *   <li>A failure Spring MVC already classified (405, 415…) keeps its status.</li>
 *   <li>Anything else is a 500 {@code INTERNAL_ERROR}, logged at ERROR with its stack and
 *       the request's correlation id, so the one answer the client sees can be traced to
 *       its cause.</li>
 * </ul>
 *
 * <p>The API's own problem bodies do not pass through here: {@link BffProxy} streams them
 * unchanged.
 */
@RestControllerAdvice
public class BffExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(BffExceptionHandler.class);

    private final PortalProperties properties;

    public BffExceptionHandler(PortalProperties properties) {
        this.properties = properties;
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<BffProblem> handleNotMapped(HttpServletRequest request) {
        return respond(BffProblem.notFound(CorrelationId.resolve(request), properties.portalApiVersion()));
    }

    @ExceptionHandler({
            HttpRequestMethodNotSupportedException.class,
            HttpMediaTypeNotSupportedException.class,
            HttpMediaTypeNotAcceptableException.class,
            ErrorResponseException.class
    })
    public ResponseEntity<BffProblem> handleFrameworkError(Exception exception, HttpServletRequest request) {
        HttpStatusCode status = ((ErrorResponse) exception).getStatusCode();
        String title = Optional.ofNullable(HttpStatus.resolve(status.value()))
                .map(HttpStatus::getReasonPhrase)
                .orElse("HTTP " + status.value());
        return respond(BffProblem.ofStatus(
                status.value(), title, CorrelationId.resolve(request), properties.portalApiVersion()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<BffProblem> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unhandled exception: {} {}", request.getMethod(), request.getRequestURI(), exception);
        return respond(BffProblem.internal(CorrelationId.resolve(request), properties.portalApiVersion()));
    }

    private static ResponseEntity<BffProblem> respond(BffProblem problem) {
        return ResponseEntity.status(problem.status())
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(problem);
    }
}
