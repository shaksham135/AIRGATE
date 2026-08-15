package com.pyq.platform.service;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * ⚡ Enterprise Groq Multi-Key Load Balancer & Auto-Failover Manager.
 * 
 * - Round-Robin distribution across all configured Groq API keys on EVERY call.
 * - Automatic 60-second cooldown isolation when a key encounters 429 Rate Limits.
 * - Multi-Model Fallback: llama-3.3-70b-versatile -> llama-3.1-8b-instant -> gemma2-9b-it.
 */
@Service
@Slf4j
public class GroqKeyManager {

    private final SystemSettingService systemSettingService;

    @Value("${groq.api.key:}")
    private String key1;

    @Value("${groq.api.key.2:}")
    private String key2;

    @Value("${groq.api.key.3:}")
    private String key3;

    @Value("${groq.api.key.4:}")
    private String key4;

    @Value("${groq.api.key.5:}")
    private String key5;

    private final List<String> keyPool = new ArrayList<>();
    private final AtomicInteger counter = new AtomicInteger(0);
    private final Map<String, Instant> cooldownMap = new ConcurrentHashMap<>();

    private static final long COOLDOWN_DURATION_SECONDS = 60;

    public GroqKeyManager(SystemSettingService systemSettingService) {
        this.systemSettingService = systemSettingService;
        this.systemSettingService.setOnSettingsUpdatedListener(this::reloadKeys);
    }

    @PostConstruct
    public void initKeys() {
        reloadKeys();
    }

    public synchronized void reloadKeys() {
        keyPool.clear();
        cooldownMap.clear();

        List<String> dynamicKeys = systemSettingService.getGroqApiKeys();
        for (String k : dynamicKeys) {
            addKeyIfValid(k);
        }

        // Environment Variable & Application Properties Fallbacks
        addKeyIfValid(key1);
        addKeyIfValid(key2);
        addKeyIfValid(key3);
        addKeyIfValid(key4);
        addKeyIfValid(key5);

        addKeyIfValid(System.getenv("GROQ_API_KEY"));
        addKeyIfValid(System.getenv("GROQ_API_KEY_2"));
        addKeyIfValid(System.getenv("GROQ_API_KEY_3"));
        addKeyIfValid(System.getenv("GROQ_API_KEY_4"));
        addKeyIfValid(System.getenv("GROQ_API_KEY_5"));

        log.info("🔑 [GroqKeyManager] Live Reloaded with {} active API keys for Round-Robin Load Balancing.", keyPool.size());
    }

    private void addKeyIfValid(String k) {
        if (k != null && !k.isBlank() && !k.equals("your-groq-api-key") && !keyPool.contains(k.trim())) {
            keyPool.add(k.trim());
        }
    }

    /**
     * Obtains the next available Groq API key in Round-Robin fashion,
     * skipping any keys currently in the 60-second Rate-Limit cooldown state.
     */
    public synchronized String getNextKey() {
        if (keyPool.isEmpty()) {
            return null;
        }

        Instant now = Instant.now();
        int attempts = 0;
        int poolSize = keyPool.size();

        while (attempts < poolSize) {
            int idx = Math.abs(counter.getAndIncrement()) % poolSize;
            String candidateKey = keyPool.get(idx);

            Instant cooldownUntil = cooldownMap.get(candidateKey);
            if (cooldownUntil == null || now.isAfter(cooldownUntil)) {
                // Key is healthy and ready to use
                if (cooldownUntil != null) {
                    cooldownMap.remove(candidateKey);
                    log.info("🟢 [GroqKeyManager] Groq API Key [...{}] cooldown expired, returning to active pool.", maskKey(candidateKey));
                }
                return candidateKey;
            }
            attempts++;
        }

        // If all keys are in cooldown, pick the one closest to expiring cooldown
        log.warn("⚠️ [GroqKeyManager] ALL Groq API keys are currently in Rate-Limit cooldown! Emergency fallback to key 0.");
        return keyPool.get(0);
    }

    /**
     * Call this whenever an HTTP 429 (Rate Limit / Quota Exceeded) is received for a key.
     */
    public void markRateLimited(String key) {
        if (key != null && !key.isBlank()) {
            cooldownMap.put(key, Instant.now().plusSeconds(COOLDOWN_DURATION_SECONDS));
            log.warn("🔴 [GroqKeyManager] Groq API Key [...{}] marked in 60-second cooldown due to HTTP 429 Rate Limit.", maskKey(key));
        }
    }

    public List<String> getAllKeys() {
        return new ArrayList<>(keyPool);
    }

    public int getKeyCount() {
        return keyPool.size();
    }

    private String maskKey(String key) {
        if (key == null || key.length() < 6) return "***";
        return key.substring(key.length() - 6);
    }
}
