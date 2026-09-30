package com.example.app.portal.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Maps every {@code /app/bff/v1/*} request, any method, onto {@link BffProxy}. */
@RestController
public class BffProxyController {

    private final BffProxy proxy;

    public BffProxyController(BffProxy proxy) {
        this.proxy = proxy;
    }

    @RequestMapping(BffProxy.BFF_PREFIX + "/**")
    public void proxy(HttpServletRequest request, HttpServletResponse response) throws IOException {
        proxy.forward(request, response);
    }
}
