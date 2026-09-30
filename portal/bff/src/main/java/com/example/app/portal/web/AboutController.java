package com.example.app.portal.web;

import com.example.app.portal.config.PortalProperties;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.boot.info.GitProperties;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code GET /app/about}: which BFF build is deployed and which browser-to-BFF contract
 * version it speaks. Public, like health. Fields read {@code "unknown"} when the build
 * metadata is absent (an IDE run, a build outside git).
 */
@RestController
public class AboutController {

    private static final String UNKNOWN = "unknown";

    private final PortalProperties properties;
    private final ObjectProvider<BuildProperties> buildProperties;
    private final ObjectProvider<GitProperties> gitProperties;

    public AboutController(
            PortalProperties properties,
            ObjectProvider<BuildProperties> buildProperties,
            ObjectProvider<GitProperties> gitProperties) {
        this.properties = properties;
        this.buildProperties = buildProperties;
        this.gitProperties = gitProperties;
    }

    @GetMapping(value = "/app/about", produces = MediaType.APPLICATION_JSON_VALUE)
    public AboutInfo about() {
        BuildProperties build = buildProperties.getIfAvailable();
        GitProperties git = gitProperties.getIfAvailable();
        String version = build != null ? build.getVersion() : UNKNOWN;
        String commit = git != null && git.getShortCommitId() != null ? git.getShortCommitId() : UNKNOWN;
        String builtAt = build != null && build.getTime() != null ? build.getTime().toString() : UNKNOWN;
        return new AboutInfo(properties.portalApiVersion(), new BuildInfo(version, commit, builtAt));
    }

    public record BuildInfo(String version, String commit, String builtAt) {}

    public record AboutInfo(int portalApiVersion, BuildInfo build) {}
}
