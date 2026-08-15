package com.pyq.platform.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.service.GroqKeyManager;
import com.pyq.platform.service.SystemSettingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;

import java.util.*;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin/settings")
@RequiredArgsConstructor
@Slf4j
public class SystemSettingController {

    private final SystemSettingService systemSettingService;
    private final GroqKeyManager groqKeyManager;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @GetMapping("/ai")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getAiSettings() {
        Map<String, String> settings = systemSettingService.getAllAiSettings();

        // Format API keys preview with masking for security
        List<String> keyList = systemSettingService.getGroqApiKeys();
        List<String> maskedKeys = new ArrayList<>();
        for (String k : keyList) {
            if (k != null && k.length() > 8) {
                maskedKeys.add(k.substring(0, 6) + "..." + k.substring(k.length() - 4));
            } else {
                maskedKeys.add("***");
            }
        }

        Map<String, Object> response = new HashMap<>();
        response.put("settings", settings);
        response.put("activeKeysCount", groqKeyManager.getKeyCount());
        response.put("maskedKeys", maskedKeys);

        return ResponseEntity.ok(response);
    }

    @PutMapping("/ai")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateAiSettings(@RequestBody Map<String, String> payload) {
        if (payload == null || payload.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Payload cannot be empty!"));
        }

        systemSettingService.saveSettings(payload);
        groqKeyManager.reloadKeys();

        return ResponseEntity.ok(new MessageResponse("AI Platform configuration updated and reloaded live in memory successfully!"));
    }

    @PostMapping("/ai/test-connection")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> testAiConnection(@RequestBody Map<String, String> payload) {
        String model = payload.getOrDefault("model", systemSettingService.getGroqFastModel());
        String apiUrl = payload.getOrDefault("apiUrl", systemSettingService.getGroqApiUrl());
        String apiKey = payload.get("apiKey");

        if (apiKey == null || apiKey.isBlank()) {
            apiKey = groqKeyManager.getNextKey();
        }

        if (apiKey == null || apiKey.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: No valid API Key provided or configured!"));
        }

        Map<String, Object> resMap = pingSingleConnection(model, apiUrl, apiKey.trim());
        return ResponseEntity.ok(resMap);
    }

    @PostMapping("/ai/test-key-pool")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> testKeyPool(@RequestBody Map<String, String> payload) {
        String rawKeys = payload.get("keys");
        String apiUrl = payload.getOrDefault("apiUrl", systemSettingService.getGroqApiUrl());
        String model = payload.getOrDefault("model", systemSettingService.getGroqFastModel());

        List<String> keys = new ArrayList<>();
        if (rawKeys != null && !rawKeys.isBlank()) {
            String[] parts = rawKeys.split("[,\\r\\n;]+");
            for (String p : parts) {
                String trimmed = p.trim();
                if (!trimmed.isEmpty() && !keys.contains(trimmed)) {
                    keys.add(trimmed);
                }
            }
        }

        if (keys.isEmpty()) {
            keys = systemSettingService.getGroqApiKeys();
        }

        if (keys.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: No keys available to test!"));
        }

        List<CompletableFuture<Map<String, Object>>> futures = keys.stream()
                .map(key -> CompletableFuture.supplyAsync(() -> {
                    Map<String, Object> pingRes = pingSingleConnection(model, apiUrl, key);
                    String masked = key.length() > 8 ? key.substring(0, 6) + "..." + key.substring(key.length() - 4) : "***";
                    pingRes.put("maskedKey", masked);
                    return pingRes;
                }))
                .collect(Collectors.toList());

        List<Map<String, Object>> results = futures.stream()
                .map(CompletableFuture::join)
                .collect(Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("totalTested", results.size());
        response.put("results", results);

        return ResponseEntity.ok(response);
    }

    private Map<String, Object> pingSingleConnection(String model, String apiUrl, String apiKey) {
        long start = System.currentTimeMillis();
        Map<String, Object> resMap = new HashMap<>();

        try {
            RestTemplate restTemplate = new RestTemplate();
            org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
            factory.setConnectTimeout(8000); // 8s
            factory.setReadTimeout(12000); // 12s
            restTemplate.setRequestFactory(factory);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(apiKey);

            ObjectNode req = objectMapper.createObjectNode();
            req.put("model", model);
            req.put("max_tokens", 10);
            req.put("temperature", 0.0);

            ArrayNode messages = req.putArray("messages");
            messages.addObject().put("role", "user").put("content", "Respond with exact word: OK");

            HttpEntity<String> entity = new HttpEntity<>(req.toString(), headers);
            ResponseEntity<String> response = restTemplate.exchange(apiUrl, HttpMethod.POST, entity, String.class);
            long latency = System.currentTimeMillis() - start;

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                String content = root.path("choices").get(0).path("message").path("content").asText("");
                String respModel = root.path("model").asText(model);

                resMap.put("status", "ACTIVE");
                resMap.put("statusCode", response.getStatusCode().value());
                resMap.put("latencyMs", latency);
                resMap.put("modelUsed", respModel);
                resMap.put("sampleOutput", content.trim());
                resMap.put("message", "Active & Healthy (Latency: " + latency + "ms)");
            } else {
                resMap.put("status", "FAILED");
                resMap.put("statusCode", response.getStatusCode().value());
                resMap.put("latencyMs", latency);
                resMap.put("message", "API responded with HTTP status " + response.getStatusCode().value());
            }

        } catch (HttpClientErrorException.Unauthorized | HttpClientErrorException.Forbidden e) {
            long latency = System.currentTimeMillis() - start;
            resMap.put("status", "INVALID_KEY");
            resMap.put("statusCode", e.getStatusCode().value());
            resMap.put("latencyMs", latency);
            resMap.put("message", "Invalid API Key or Bad Authentication (HTTP " + e.getStatusCode().value() + ")");
        } catch (HttpClientErrorException.TooManyRequests e) {
            long latency = System.currentTimeMillis() - start;
            resMap.put("status", "RATE_LIMITED");
            resMap.put("statusCode", 429);
            resMap.put("latencyMs", latency);
            resMap.put("message", "Rate limit hit or quota exhausted (HTTP 429)");
        } catch (HttpClientErrorException.NotFound e) {
            long latency = System.currentTimeMillis() - start;
            resMap.put("status", "MODEL_DECOMMISSIONED");
            resMap.put("statusCode", 404);
            resMap.put("latencyMs", latency);
            resMap.put("message", "Model ID not found or decommissioned by provider (HTTP 404)");
        } catch (HttpClientErrorException e) {
            long latency = System.currentTimeMillis() - start;
            resMap.put("status", "FAILED");
            resMap.put("statusCode", e.getStatusCode().value());
            resMap.put("latencyMs", latency);
            resMap.put("message", "Provider returned error: " + e.getResponseBodyAsString());
        } catch (Exception e) {
            long latency = System.currentTimeMillis() - start;
            resMap.put("status", "FAILED");
            resMap.put("latencyMs", latency);
            resMap.put("message", "Connection failed: " + e.getMessage());
        }

        return resMap;
    }
}
