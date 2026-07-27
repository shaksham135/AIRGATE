package com.pyq.platform.service;

import com.pyq.platform.repository.AiRequestRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Service that tracks Groq token usage for the free‑tier limits.
 * Token usage is persisted in the database (ai_requests) so restarting backend preserves history.
 */
@Service
@Slf4j
public class GroqUsageService {

    private final AiRequestRepository aiRequestRepository;
    private final AtomicLong runtimeSessionTokens = new AtomicLong(0);

    private static final long FREE_TIER_LIMIT = 10_000_000L;
    private static final double WARNING_THRESHOLD = 0.80; // 80%

    public GroqUsageService(AiRequestRepository aiRequestRepository) {
        this.aiRequestRepository = aiRequestRepository;
    }

    /**
     * Add the number of tokens used in a single Groq request.
     * Logs a warning when usage exceeds the warning threshold.
     */
    public void addTokens(long tokenCount) {
        runtimeSessionTokens.addAndGet(tokenCount);
        long currentTotal = getCurrentUsage();

        if (currentTotal > WARNING_THRESHOLD * FREE_TIER_LIMIT) {
            log.warn("[Groq] Monthly token usage has crossed {}% of free tier: {} / {} tokens",
                    (int) (WARNING_THRESHOLD * 100), currentTotal, FREE_TIER_LIMIT);
        } else {
            log.info("[Groq] Added {} tokens. Current monthly usage: {} / {}", tokenCount, currentTotal, FREE_TIER_LIMIT);
        }
    }

    /** Returns the current token usage for the current month from DB + session memory. */
    public long getCurrentUsage() {
        LocalDateTime startOfMonth = LocalDate.now().withDayOfMonth(1).atStartOfDay();
        long dbTokensThisMonth = aiRequestRepository.sumTokensSince(startOfMonth);
        return dbTokensThisMonth + runtimeSessionTokens.get();
    }

    /** Returns the free‑tier limit. */
    public long getLimit() {
        return FREE_TIER_LIMIT;
    }

    /**
     * Scheduled log notice at start of month.
     */
    @Scheduled(cron = "0 0 0 1 * *")
    public void resetMonthlyUsage() {
        log.info("[Groq] Start of new calendar month. Token usage window reset for new month.");
        runtimeSessionTokens.set(0);
    }
}
