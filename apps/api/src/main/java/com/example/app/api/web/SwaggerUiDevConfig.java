package com.example.app.api.web;

import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * Serves the bundled Swagger UI static assets, but only under the {@code dev} profile.
 * Elsewhere {@code /swagger-ui/**} and {@code /swagger-ui.html} return 404 while the
 * OpenAPI document ({@link OpenApiController}) stays available.
 *
 * <p>The version segment matches the {@code swagger-ui.version} property in
 * {@code apps/api/pom.xml}; keep the two in sync.
 */
@Configuration(proxyBeanMethods = false)
@Profile("dev")
public class SwaggerUiDevConfig implements WebMvcConfigurer {

    private static final String SWAGGER_UI_WEBJAR =
            "classpath:/META-INF/resources/webjars/swagger-ui/5.21.0/";

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/swagger-ui/dist/**").addResourceLocations(SWAGGER_UI_WEBJAR);
    }
}
