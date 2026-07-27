package com.pyq.platform.config;

import io.github.bucket4j.Bandwidth;
import io.github.bucket4j.Bucket;
import io.github.bucket4j.Bucket4j;
import io.github.bucket4j.Refill;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import jakarta.annotation.PostConstruct;
import java.time.Duration;
import java.util.function.Supplier;

@Configuration
public class RateLimitConfig {

    @Value("${rate.limit.enabled:true}")
    private boolean rateLimitEnabled;

    @Value("${rate.limit.public-api.requests-per-minute:60}")
    private int publicApiRequestsPerMinute;

    @Value("${rate.limit.authenticated-api.requests-per-minute:300}")
    private int authenticatedApiRequestsPerMinute;

    @Value("${rate.limit.upload-api.requests-per-hour:10}")
    private int uploadApiRequestsPerHour;

    private final CacheManager cacheManager;

    public RateLimitConfig(CacheManager cacheManager) {
        this.cacheManager = cacheManager;
    }

    @PostConstruct
    public void init() {
        System.out.println("Rate limiting enabled: " + rateLimitEnabled);
    }

    @Bean
    public Supplier<Bucket> publicApiRateLimiter() {
        return () -> createBucket(
            Bandwidth.classic(publicApiRequestsPerMinute, Refill.intervally(publicApiRequestsPerMinute, Duration.ofMinutes(1)))
        );
    }

    @Bean
    public Supplier<Bucket> authenticatedApiRateLimiter() {
        return () -> createBucket(
            Bandwidth.classic(authenticatedApiRequestsPerMinute, Refill.intervally(authenticatedApiRequestsPerMinute, Duration.ofMinutes(1)))
        );
    }

    @Bean
    public Supplier<Bucket> uploadApiRateLimiter() {
        return () -> createBucket(
            Bandwidth.classic(uploadApiRequestsPerHour, Refill.intervally(uploadApiRequestsPerHour, Duration.ofHours(1)))
        );
    }

    private Bucket createBucket(Bandwidth limit) {
        if (!rateLimitEnabled) {
            // Return unlimited bucket if rate limiting is disabled
            return Bucket4j.builder()
                .addLimit(Bandwidth.classic(Integer.MAX_VALUE, Refill.intervally(Integer.MAX_VALUE, Duration.ofDays(1))))
                .build();
        }
        return Bucket4j.builder()
            .addLimit(limit)
            .build();
    }

    public boolean isRateLimitEnabled() {
        return rateLimitEnabled;
    }
}
