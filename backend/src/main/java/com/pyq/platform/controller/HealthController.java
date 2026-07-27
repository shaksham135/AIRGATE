package com.pyq.platform.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.lang.management.ManagementFactory;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
public class HealthController {

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    private final JdbcTemplate jdbcTemplate;

    // Rate limiter memory cache: IP -> RequestCounter
    private final Map<String, RequestCounter> rateLimitCache = new ConcurrentHashMap<>();
    private static final int MAX_REQUESTS_PER_MINUTE = 60;
    private static final long TIME_WINDOW_MS = 60_000L; // 1 minute

    public HealthController(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    private static class RequestCounter {
        long startTime;
        int count;

        RequestCounter(long startTime) {
            this.startTime = startTime;
            this.count = 1;
        }
    }

    @GetMapping({"/", "/health", "/api/public/health"})
    public ResponseEntity<Map<String, Object>> getHealthStatus(HttpServletRequest request) {
        String clientIp = getClientIp(request);
        long now = System.currentTimeMillis();

        // Check & Enforce 60 requests/min rate limit per IP
        RequestCounter counter = rateLimitCache.compute(clientIp, (ip, existingCounter) -> {
            if (existingCounter == null || (now - existingCounter.startTime) > TIME_WINDOW_MS) {
                return new RequestCounter(now);
            } else {
                existingCounter.count++;
                return existingCounter;
            }
        });

        if (counter.count > MAX_REQUESTS_PER_MINUTE) {
            Map<String, Object> rateLimitResponse = new HashMap<>();
            rateLimitResponse.put("status", "TOO_MANY_REQUESTS");
            rateLimitResponse.put("error", "Rate limit exceeded. Maximum 60 health check requests per minute allowed.");
            rateLimitResponse.put("clientIp", clientIp);
            rateLimitResponse.put("retryAfterSeconds", 60);
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(rateLimitResponse);
        }

        // Check DB Connectivity
        boolean dbStatus = checkDatabaseConnection();

        Map<String, Object> health = new HashMap<>();
        health.put("status", dbStatus ? "UP" : "DEGRADED");
        health.put("platform", "AIRGATE Platform");
        health.put("timestamp", Instant.now().toString());
        health.put("frontendUrl", frontendUrl);
        health.put("database", dbStatus ? "CONNECTED" : "DISCONNECTED");
        health.put("uptimeSeconds", ManagementFactory.getRuntimeMXBean().getUptime() / 1000);
        health.put("rateLimit", Map.of(
            "requestsThisMinute", counter.count,
            "maxAllowedPerMinute", MAX_REQUESTS_PER_MINUTE
        ));

        return ResponseEntity.ok(health);
    }

    private boolean checkDatabaseConnection() {
        try {
            Integer result = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return result != null && result == 1;
        } catch (Exception e) {
            return false;
        }
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip != null ? ip : "127.0.0.1";
    }
}
