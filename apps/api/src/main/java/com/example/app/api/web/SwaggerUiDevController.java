package com.example.app.api.web;

import org.springframework.context.annotation.Profile;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;

/**
 * Renders the Swagger UI page against the authoritative OpenAPI document, only under the
 * {@code dev} profile. The assets are served by {@link SwaggerUiDevConfig}.
 */
@Controller
@Profile("dev")
public class SwaggerUiDevController {

    private static final String PAGE =
            """
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <title>API — Swagger UI</title>
              <link rel="stylesheet" href="/swagger-ui/dist/swagger-ui.css">
            </head>
            <body>
              <div id="swagger-ui"></div>
              <script src="/swagger-ui/dist/swagger-ui-bundle.js"></script>
              <script>
                window.ui = SwaggerUIBundle({
                  url: '/v3/api-docs.yaml',
                  dom_id: '#swagger-ui'
                });
              </script>
            </body>
            </html>
            """;

    @GetMapping(value = "/swagger-ui.html", produces = MediaType.TEXT_HTML_VALUE)
    @ResponseBody
    public String index() {
        return PAGE;
    }
}
