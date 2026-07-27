package com.pyq.platform.config;

import io.github.bucket4j.Bucket;
import io.github.bucket4j.ConsumptionProbe;
import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.function.Supplier;

@Component
@Order(1)
@Slf4j
public class RateLimitFilter implements Filter {

    private final Supplier<Bucket> publicApiRateLimiter;
    private final Supplier<Bucket> authenticatedApiRateLimiter;
    private final Supplier<Bucket> uploadApiRateLimiter;
    private final RateLimitConfig rateLimitConfig;

    private final ConcurrentMap<String, Bucket> cache = new ConcurrentHashMap<>();

    public RateLimitFilter(Supplier<Bucket> publicApiRateLimiter,
                          Supplier<Bucket> authenticatedApiRateLimiter,
                          Supplier<Bucket> uploadApiRateLimiter,
                          RateLimitConfig rateLimitConfig) {
        this.publicApiRateLimiter = publicApiRateLimiter;
        this.authenticatedApiRateLimiter = authenticatedApiRateLimiter;
        this.uploadApiRateLimiter = uploadApiRateLimiter;
        this.rateLimitConfig = rateLimitConfig;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        if (!rateLimitConfig.isRateLimitEnabled()) {
            chain.doFilter(request, response);
            return;
        }

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        String clientIp = getClientIp(httpRequest);
        String uri = httpRequest.getRequestURI();

        // Use route category instead of full URI to prevent unbounded cache growth.
        // e.g. /api/questions/123 and /api/questions/456 share the same bucket.
        String routeCategory = resolveRouteCategory(uri, httpRequest.getMethod());
        String key = clientIp + ":" + routeCategory;

        Supplier<Bucket> rateLimiter = getRateLimiterForUri(httpRequest);
        Bucket bucket = cache.computeIfAbsent(key, k -> rateLimiter.get());

        ConsumptionProbe probe = bucket.tryConsumeAndReturnRemaining(1);

        if (probe.isConsumed()) {
            httpResponse.setHeader("X-Rate-Limit-Remaining", String.valueOf(probe.getRemainingTokens()));
            chain.doFilter(request, response);
        } else {
            httpResponse.setStatus(429);
            httpResponse.setContentType("application/json");
            httpResponse.getWriter().write("{\"error\":\"Too many requests\",\"message\":\"Rate limit exceeded. Please try again later.\"}");
            log.warn("Rate limit exceeded for IP: {} on route category: {}", clientIp, routeCategory);
        }
    }

    private String resolveRouteCategory(String uri, String method) {
        if (uri.startsWith("/api/uploads") || uri.startsWith("/uploads")) {
            return "UPLOADS";
        } else if (uri.startsWith("/api/auth")) {
            return "AUTH";
        } else if (uri.startsWith("/api/questions")) {
            return "QUESTIONS";
        } else if (uri.startsWith("/api/subjects") || uri.startsWith("/api/topics")) {
            return "TAXONOMY";
        } else if (uri.startsWith("/api/chat")) {
            return "CHAT";
        } else if (uri.startsWith("/api/payments")) {
            return "PAYMENTS";
        }
        return "GENERAL";
    }

    private Supplier<Bucket> getRateLimiterForUri(HttpServletRequest request) {
        String uri = request.getRequestURI();
        String method = request.getMethod();

        if (("/api/uploads".equals(uri) || "/api/uploads/".equals(uri)) && "POST".equalsIgnoreCase(method)) {
            return uploadApiRateLimiter;
        } else if (uri.startsWith("/uploads")) {
            return uploadApiRateLimiter;
        } else if (uri.startsWith("/api/auth") || uri.startsWith("/api/questions") || 
                   uri.startsWith("/api/subjects") || uri.startsWith("/api/topics")) {
            return publicApiRateLimiter;
        }
        return authenticatedApiRateLimiter;
    }

    private String getClientIp(HttpServletRequest request) {
        String xfHeader = request.getHeader("X-Forwarded-For");
        if (xfHeader == null) {
            return request.getRemoteAddr();
        }
        return xfHeader.split(",")[0];
    }
}

