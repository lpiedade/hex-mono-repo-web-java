package com.example.app.api.web;

import com.example.app.api.contract.model.ApiBuildInfo;
import com.example.app.api.contract.model.BuildCoordinates;
import com.example.app.api.contract.model.SchemaVersion;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.info.GitProperties;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /api/v1/about}: which build of the API is deployed. The portal shows it
 * beside its own, because the two are deployed separately and can lag.
 *
 * <p>Coordinates come from {@code META-INF/build-info.properties} and
 * {@code git.properties}, both written into {@code target/} by the build. When either
 * is absent — an IDE run before packaging, a build outside git — the field reads
 * {@code "unknown"} rather than failing the request.
 */
@RestController
@RequestMapping("/api/v1")
public class AboutController {

    private static final String UNKNOWN = "unknown";

    private final ObjectProvider<BuildProperties> buildProperties;
    private final ObjectProvider<GitProperties> gitProperties;

    public AboutController(ObjectProvider<BuildProperties> buildProperties, ObjectProvider<GitProperties> gitProperties) {
        this.buildProperties = buildProperties;
        this.gitProperties = gitProperties;
    }

    @GetMapping(value = "/about", produces = MediaType.APPLICATION_JSON_VALUE)
    public ApiBuildInfo about() {
        BuildProperties build = buildProperties.getIfAvailable();
        GitProperties git = gitProperties.getIfAvailable();
        String version = build != null ? build.getVersion() : UNKNOWN;
        String commit = git != null && git.getShortCommitId() != null ? git.getShortCommitId() : UNKNOWN;
        String builtAt = build != null && build.getTime() != null ? build.getTime().toString() : UNKNOWN;
        return new ApiBuildInfo()
                .schemaVersion(SchemaVersion.NUMBER_1)
                .build(new BuildCoordinates().version(version).commit(commit).builtAt(builtAt));
    }
}
