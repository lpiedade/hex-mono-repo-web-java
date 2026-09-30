package com.example.app.api.web;

import com.example.app.api.contract.model.FieldError;
import com.example.app.api.contract.model.ProblemDetails;
import com.example.app.domain.error.ApplicationProblem;
import com.example.app.domain.error.ProblemException;
import com.example.app.domain.error.ProblemKind;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.ErrorResponse;
import org.springframework.web.ErrorResponseException;
import org.springframework.web.HttpMediaTypeNotAcceptableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Translates controller-layer exceptions into RFC 9457 Problem Details.
 *
 * <ul>
 *   <li>A {@link ProblemException} from {@code core} carries its own problem, so one
 *       handler serves every subdomain's refusals.</li>
 *   <li>A malformed request — unreadable body, invalid field, wrong parameter type such
 *       as a path id that is not a UUID, missing header or parameter — is a safe 400.</li>
 *   <li>Anything else the framework already classified keeps its status (405, 415…).</li>
 *   <li>Anything unexpected is logged with the correlation id and answered as a generic
 *       500. No body carries a stack trace, SQL, or secret.</li>
 * </ul>
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ProblemException.class)
    public ResponseEntity<ProblemDetails> handleProblem(ProblemException exception, HttpServletRequest request) {
        ApplicationProblem problem = exception.problem();
        if (problem.kind() == ProblemKind.INTERNAL) {
            log.error("Internal problem {}", problem.code(), exception);
        } else {
            log.info("Refused with {}: {}", problem.code(), exception.getMessage());
        }
        return ProblemResponses.of(problem, request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ProblemDetails> handleNotMapped(HttpServletRequest request) {
        return ProblemResponses.of(ApplicationProblem.NOT_FOUND, request);
    }

    @ExceptionHandler({
            MissingRequestHeaderException.class,
            MissingServletRequestParameterException.class,
            HttpMessageNotReadableException.class,
            MethodArgumentTypeMismatchException.class
    })
    public ResponseEntity<ProblemDetails> handleMalformedRequest(HttpServletRequest request) {
        return ProblemResponses.of(ApplicationProblem.BAD_REQUEST, request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetails> handleInvalidBody(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<FieldError> errors = exception.getBindingResult().getFieldErrors().stream()
                .map(fieldError -> new FieldError(fieldError.getField(), "INVALID")
                        .message(fieldError.getDefaultMessage()))
                .toList();
        return ProblemResponses.of(ApplicationProblem.BAD_REQUEST, errors, request);
    }

    /**
     * A failure Spring MVC has already given a status to — an unsupported method or
     * media type. Rendering it as a 500 would tell the client the service broke and
     * invite a retry that cannot succeed.
     */
    @ExceptionHandler({
            HttpRequestMethodNotSupportedException.class,
            HttpMediaTypeNotSupportedException.class,
            HttpMediaTypeNotAcceptableException.class,
            ErrorResponseException.class
    })
    public ResponseEntity<ProblemDetails> handleFrameworkError(Exception exception, HttpServletRequest request) {
        HttpStatusCode status = ((ErrorResponse) exception).getStatusCode();
        HttpStatus known = HttpStatus.resolve(status.value());
        String name = known != null ? known.name() : "HTTP_" + status.value();
        String title = known != null ? known.getReasonPhrase() : name;
        ApplicationProblem problem = new ApplicationProblem(
                ProblemKind.BAD_REQUEST, name, title, "The request cannot be served as sent.");
        String correlationId = CorrelationId.resolve(request);
        return ResponseEntity.status(status)
                .header(CorrelationId.HEADER, correlationId)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(ProblemDetailsFactory.of(problem, status.value(), correlationId, List.of()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetails> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unhandled exception", exception);
        return ProblemResponses.of(ApplicationProblem.INTERNAL_ERROR, request);
    }
}
