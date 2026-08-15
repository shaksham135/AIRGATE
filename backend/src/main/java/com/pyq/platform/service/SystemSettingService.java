package com.pyq.platform.service;

import com.pyq.platform.entity.SystemSetting;
import com.pyq.platform.repository.SystemSettingRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class SystemSettingService {

    private final SystemSettingRepository systemSettingRepository;

    @Value("${groq.model.fast:llama-3.3-70b-versatile}")
    private String fallbackFastModel;

    @Value("${groq.model.heavy:llama-3.3-70b-versatile}")
    private String fallbackHeavyModel;

    @Value("${groq.api.key:}")
    private String fallbackGroqKey;

    private Runnable onSettingsUpdatedListener;

    public void setOnSettingsUpdatedListener(Runnable listener) {
        this.onSettingsUpdatedListener = listener;
    }

    @Cacheable(value = "systemSettings", key = "#key", unless = "#result == null")
    public String getSetting(String key, String defaultValue) {
        try {
            Optional<SystemSetting> setting = systemSettingRepository.findById(key);
            if (setting.isPresent() && setting.get().getSettingValue() != null && !setting.get().getSettingValue().isBlank()) {
                return setting.get().getSettingValue().trim();
            }
        } catch (Exception e) {
            log.warn("⚠️ Error reading system_setting key '{}': {}", key, e.getMessage());
        }
        return defaultValue;
    }

    public String getGroqFastModel() {
        return getSetting("groq_fast_model", fallbackFastModel);
    }

    public String getGroqHeavyModel() {
        return getSetting("groq_heavy_model", fallbackHeavyModel);
    }

    public String getGroqApiUrl() {
        return getSetting("groq_api_url", "https://api.groq.com/openai/v1/chat/completions");
    }

    public String getAiTutorModel() {
        return getSetting("ai_tutor_model", getGroqFastModel());
    }

    public String getAiTutorApiUrl() {
        return getSetting("ai_tutor_api_url", getGroqApiUrl());
    }

    public int getAiTutorMaxTokens() {
        try {
            String val = getSetting("ai_tutor_max_tokens", "2000");
            return Integer.parseInt(val);
        } catch (Exception e) {
            return 2000;
        }
    }

    public int getAiSolutionMaxTokens() {
        try {
            String val = getSetting("ai_solution_max_tokens", "3500");
            return Integer.parseInt(val);
        } catch (Exception e) {
            return 3500;
        }
    }

    public List<String> getGroqApiKeys() {
        String rawKeys = getSetting("groq_api_keys", "");
        List<String> keys = new ArrayList<>();

        if (!rawKeys.isBlank()) {
            String[] parts = rawKeys.split("[,\\r\\n;]+");
            for (String p : parts) {
                String trimmed = p.trim();
                if (!trimmed.isEmpty() && !keys.contains(trimmed)) {
                    keys.add(trimmed);
                }
            }
        }

        // Fall back to application properties / env vars if DB pool is empty
        if (keys.isEmpty()) {
            if (fallbackGroqKey != null && !fallbackGroqKey.isBlank()) {
                keys.add(fallbackGroqKey.trim());
            }
            String envKey = System.getenv("GROQ_API_KEY");
            if (envKey != null && !envKey.isBlank() && !keys.contains(envKey.trim())) {
                keys.add(envKey.trim());
            }
        }

        return keys;
    }

    public Map<String, String> getAllAiSettings() {
        List<SystemSetting> list = systemSettingRepository.findByCategory("AI");
        Map<String, String> map = new HashMap<>();
        for (SystemSetting s : list) {
            map.put(s.getSettingKey(), s.getSettingValue() != null ? s.getSettingValue() : "");
        }
        // Ensure defaults are populated in response
        map.putIfAbsent("groq_fast_model", getGroqFastModel());
        map.putIfAbsent("groq_heavy_model", getGroqHeavyModel());
        map.putIfAbsent("groq_api_url", getGroqApiUrl());
        map.putIfAbsent("ai_tutor_model", getAiTutorModel());
        map.putIfAbsent("ai_tutor_api_url", getAiTutorApiUrl());
        map.putIfAbsent("ai_tutor_max_tokens", String.valueOf(getAiTutorMaxTokens()));
        map.putIfAbsent("ai_solution_max_tokens", String.valueOf(getAiSolutionMaxTokens()));
        map.putIfAbsent("groq_api_keys", getSetting("groq_api_keys", ""));
        return map;
    }

    @Transactional
    @CacheEvict(value = "systemSettings", allEntries = true)
    public void saveSettings(Map<String, String> settings) {
        if (settings == null || settings.isEmpty()) return;

        for (Map.Entry<String, String> entry : settings.entrySet()) {
            String k = entry.getKey();
            String v = entry.getValue() != null ? entry.getValue().trim() : "";

            SystemSetting setting = systemSettingRepository.findById(k)
                    .orElseGet(() -> SystemSetting.builder()
                            .settingKey(k)
                            .category("AI")
                            .description("Dynamic AI Platform Configuration")
                            .build());

            setting.setSettingValue(v);
            systemSettingRepository.save(setting);
        }

        log.info("✅ [SystemSettingService] Saved {} AI settings to Database and evicted cache.", settings.size());

        if (onSettingsUpdatedListener != null) {
            try {
                onSettingsUpdatedListener.run();
            } catch (Exception e) {
                log.error("Failed to notify settings update listener: {}", e.getMessage());
            }
        }
    }
}
