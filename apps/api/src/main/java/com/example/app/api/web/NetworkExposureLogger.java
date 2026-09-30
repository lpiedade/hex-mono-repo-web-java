package com.example.app.api.web;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.web.server.context.WebServerInitializedEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Logs the effective HTTP bind address once the web server is up. The API binds to
 * loopback by default; a non-loopback bind is a deliberate exposure and is logged as a
 * warning so it is never accidental. The message carries no credential or URL.
 */
@Component
public class NetworkExposureLogger implements ApplicationListener<WebServerInitializedEvent> {

    private static final Logger log = LoggerFactory.getLogger(NetworkExposureLogger.class);

    private final Environment environment;

    public NetworkExposureLogger(Environment environment) {
        this.environment = environment;
    }

    @Override
    public void onApplicationEvent(WebServerInitializedEvent event) {
        int port = event.getWebServer().getPort();
        String address = environment.getProperty("server.address", "0.0.0.0");
        if (isLoopback(address)) {
            log.info("API bound to loopback {}:{}. Set APP_SERVER_ADDRESS to bind other interfaces.",
                    address, port);
        } else {
            log.warn("API bound to non-loopback {}:{}. Every host that can reach the port can call it; "
                    + "make sure it sits behind the intended network boundary.", address, port);
        }
    }

    private static boolean isLoopback(String address) {
        return address == null
                || address.isBlank()
                || address.equals("127.0.0.1")
                || address.equals("::1")
                || address.equalsIgnoreCase("localhost");
    }
}
