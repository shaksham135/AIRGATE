package com.pyq.platform.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pyq.platform.security.UserDetailsImpl;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.time.LocalDate;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/chat")
@Slf4j
public class AiTutorChatController {

    private static final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    @Value("${ai.tutor.provider:AUTO}")
    private String tutorProvider; // AUTO, DEEPSEEK, GROQ, GEMINI, OPENAI

    @Value("${ai.tutor.api.url:https://api.deepseek.com/v1/chat/completions}")
    private String tutorApiUrl;

    @Value("${ai.tutor.api.key:}")
    private String tutorApiKey;

    @Value("${ai.tutor.model:deepseek-chat}")
    private String tutorModel;

    @Value("${gemini.api.key.tutor:}")
    private String geminiTutorKey; // Dedicated Gemini key

    @Value("${gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    @Value("${groq.model.fast:llama-3.1-8b-instant}")
    private String fastModel;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private RestTemplate restTemplate;
    private final com.pyq.platform.repository.AiRequestRepository aiRequestRepository;
    private final com.pyq.platform.repository.UserRepository userRepository;
    private final com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository;
    private final com.pyq.platform.service.GroqKeyManager groqKeyManager;

    public AiTutorChatController(com.pyq.platform.repository.AiRequestRepository aiRequestRepository,
                                 com.pyq.platform.repository.UserRepository userRepository,
                                 com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository,
                                 com.pyq.platform.service.GroqKeyManager groqKeyManager) {
        this.aiRequestRepository = aiRequestRepository;
        this.userRepository = userRepository;
        this.systemSettingsRepository = systemSettingsRepository;
        this.groqKeyManager = groqKeyManager;
    }

    @PostConstruct
    public void init() {
        // Resolve DeepSeek / Custom Key from env if not set in application properties
        if (tutorApiKey == null || tutorApiKey.isBlank()) {
            tutorApiKey = System.getenv("AI_TUTOR_API_KEY");
            if (tutorApiKey == null || tutorApiKey.isBlank()) {
                tutorApiKey = System.getenv("DEEPSEEK_API_KEY");
            }
        }

        // Resolve Gemini tutor key from env if not set
        if (geminiTutorKey == null || geminiTutorKey.isBlank()) {
            geminiTutorKey = System.getenv("GEMINI_API_KEY_TUTOR");
        }

        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(40000);
        this.restTemplate = new RestTemplate(factory);

        log.info("🤖 [AiTutorChatController] Initialized with Provider Mode: {}, Target Model: {}", tutorProvider, tutorModel);
    }

    /**
     * POST /api/chat/tutor
     * Authenticated endpoint. Sends user message + question context to AI Tutor.
     */
    @PostMapping("/tutor")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> askTutor(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        if (userDetails == null || userDetails.getId() == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized access."));
        }

        // Fetch live user status & check subscription expiry
        com.pyq.platform.entity.User dbUser = userRepository.findById(userDetails.getId()).orElse(null);
        boolean isPremium = dbUser != null && Boolean.TRUE.equals(dbUser.getIsPremium());
        if (isPremium && dbUser.getPremiumExpiresAt() != null && dbUser.getPremiumExpiresAt().isBefore(LocalDateTime.now())) {
            isPremium = false;
        }

        int dailyLimit = isPremium ? 50 : 3;

        // Load settings to fetch dynamically configured AI limit for premium users
        if (isPremium) {
            try {
                com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
                if (settings != null) {
                    dailyLimit = settings.getAiDailyLimitPremium();
                }
            } catch (Exception e) {
                // fallback to default limit
            }
        }

        // DB-backed daily rate limit — survives server restarts
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();
        long usedToday = aiRequestRepository.countByUserIdAndRequestedAtAfter(userDetails.getId(), startOfToday);
        if (usedToday >= dailyLimit) {
            log.warn("AI Tutor daily limit ({}) reached for user ID: {} (IsPremium: {})", dailyLimit, userDetails.getId(), isPremium);
            if (!isPremium) {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body(Map.of("error", "Free Daily Limit Reached! You have used your 3 free daily AI Tutor queries. Upgrade to Aspirant Pro for unlimited access."));
            } else {
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body(Map.of("error", "You have reached your daily limit of AI Tutor requests. Please try again tomorrow."));
            }
        }

        String userMessage = (String) body.getOrDefault("message", "");
        if (userMessage.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Message cannot be empty."));
        }

        String questionText = (String) body.getOrDefault("questionText", "N/A");
        String questionType = (String) body.getOrDefault("questionType", "MCQ");
        String subjectName = (String) body.getOrDefault("subjectName", "GATE CSE");
        String topicName = (String) body.getOrDefault("topicName", "General");
        String suggestedAnswer = (String) body.getOrDefault("suggestedAnswer", "N/A");
        String optionsText = (String) body.getOrDefault("optionsText", "N/A");
        String imagePath = (String) body.getOrDefault("imagePath", null);

        @SuppressWarnings("unchecked")
        List<Map<String, String>> history = (List<Map<String, String>>) body.getOrDefault("history", List.of());

        try {
            String systemPrompt = "You are an expert GATE CSE AI Tutor helping a student understand a specific exam question.\n"
                    + "CRITICAL RULES:\n"
                    + "1. GROUND-TRUTH ANCHORING: The platform's verified answer key is: " + suggestedAnswer + ". Your logical explanation MUST strictly support and align with " + suggestedAnswer + ". Do NOT contradict or hallucinate a different choice.\n"
                    + "2. Be clear, direct, and structured step-by-step.\n"
                    + "3. Standard Markdown formatting (bold, inline code, formulas using $...$).\n"
                    + "4. DIAGRAM RULES: If asked for a diagram or flowchart, wrap the Mermaid definition STRICTLY inside standard backticks code block:\n"
                    + "   ```mermaid\n"
                    + "   graph LR\n"
                    + "   A --> B\n"
                    + "   ```\n"
                    + "   NEVER print raw 'graph LR' or mermaid text without the ```mermaid backticks fences!\n"
                    + "5. Zero repetition loops: state logic clearly without repeating phrases.\n\n"
                    + "QUESTION CONTEXT:\n"
                    + "- Type: " + questionType + "\n"
                    + "- Subject: " + subjectName + "\n"
                    + "- Topic: " + topicName + "\n"
                    + "- Question Stem: " + questionText + "\n"
                    + "- Options:\n" + optionsText + "\n"
                    + "- VERIFIED CORRECT ANSWER: " + suggestedAnswer + "\n\n"
                    + "Help the student understand step-by-step why " + suggestedAnswer + " is correct.";

            String reply;
            String model;
            int promptTokens = 0;
            int completionTokens = 0;

            // ── 1. PRIMARY: DeepSeek / Custom OpenAI-Compatible Gateway ─────────
            if (tutorApiKey != null && !tutorApiKey.isBlank()) {
                try {
                    log.info("🚀 [AI Tutor] Using DeepSeek / Custom AI Provider ({}) as primary model...", tutorModel);
                    ObjectNode payload = objectMapper.createObjectNode();
                    payload.put("model", tutorModel);
                    payload.put("temperature", 0.1);
                    payload.put("frequency_penalty", 0.2);
                    payload.put("presence_penalty", 0.2);
                    payload.put("max_tokens", 2000);

                    ArrayNode messages = payload.putArray("messages");
                    messages.addObject().put("role", "system").put("content", systemPrompt);

                    int start = Math.max(0, history.size() - 6);
                    for (int i = start; i < history.size(); i++) {
                        Map<String, String> turn = history.get(i);
                        String role = "assistant".equals(turn.get("role")) ? "assistant" : "user";
                        messages.addObject().put("role", role).put("content", turn.getOrDefault("text", ""));
                    }
                    messages.addObject().put("role", "user").put("content", userMessage);

                    HttpHeaders dsHeaders = new HttpHeaders();
                    dsHeaders.setContentType(MediaType.APPLICATION_JSON);
                    dsHeaders.setBearerAuth(tutorApiKey.trim());

                    HttpEntity<String> entity = new HttpEntity<>(payload.toString(), dsHeaders);
                    ResponseEntity<String> res = restTemplate.exchange(tutorApiUrl, HttpMethod.POST, entity, String.class);

                    if (res.getStatusCode().is2xxSuccessful() && res.getBody() != null) {
                        JsonNode json = objectMapper.readTree(res.getBody());
                        reply = json.path("choices").get(0).path("message").path("content").asText("");
                        model = json.path("model").asText(tutorModel);
                        promptTokens = json.path("usage").path("prompt_tokens").asInt(0);
                        completionTokens = json.path("usage").path("completion_tokens").asInt(0);

                        if (!reply.isBlank()) {
                            log.info("✅ [AI Tutor] DeepSeek / Custom Provider response delivered successfully!");
                            logAiRequest(userDetails.getId(), model, promptTokens, completionTokens, topicName);
                            return ResponseEntity.ok(Map.of("reply", reply));
                        }
                    }
                } catch (Exception dsEx) {
                    log.warn("⚠️ [AI Tutor] DeepSeek / Custom Provider call failed ({}). Falling back...", dsEx.getMessage());
                }
            }

            // ── 2. SECONDARY: Google Gemini 1.5/2.5 Flash ───────────────────────
            if (geminiTutorKey != null && !geminiTutorKey.isBlank()) {
                try {
                    log.info("🌟 [AI Tutor] Using Google Gemini as secondary provider...");
                    ObjectNode geminiBody = objectMapper.createObjectNode();

                    ObjectNode sysInstruction = objectMapper.createObjectNode();
                    ArrayNode sysParts = objectMapper.createArrayNode();
                    sysParts.add(objectMapper.createObjectNode().put("text", systemPrompt));
                    sysInstruction.set("parts", sysParts);
                    geminiBody.set("systemInstruction", sysInstruction);

                    ArrayNode contents = objectMapper.createArrayNode();
                    int start = Math.max(0, history.size() - 6);
                    for (int i = start; i < history.size(); i++) {
                        Map<String, String> turn = history.get(i);
                        String role = "assistant".equals(turn.get("role")) ? "model" : "user";
                        ObjectNode msgObj = objectMapper.createObjectNode();
                        msgObj.put("role", role);
                        ArrayNode msgParts = objectMapper.createArrayNode();
                        msgParts.add(objectMapper.createObjectNode().put("text", turn.getOrDefault("text", "")));
                        msgObj.set("parts", msgParts);
                        contents.add(msgObj);
                    }
                    ObjectNode curMsg = objectMapper.createObjectNode();
                    curMsg.put("role", "user");
                    ArrayNode curParts = objectMapper.createArrayNode();
                    curParts.add(objectMapper.createObjectNode().put("text", userMessage));
                    curMsg.set("parts", curParts);
                    contents.add(curMsg);
                    geminiBody.set("contents", contents);

                    ObjectNode genConfig = objectMapper.createObjectNode();
                    genConfig.put("temperature", 0.1);
                    genConfig.put("maxOutputTokens", 2000);
                    geminiBody.set("generationConfig", genConfig);

                    HttpHeaders geminiHeaders = new HttpHeaders();
                    geminiHeaders.setContentType(MediaType.APPLICATION_JSON);
                    String geminiUrl = GEMINI_BASE_URL + geminiModel + ":generateContent?key=" + geminiTutorKey;
                    ResponseEntity<String> geminiResp = restTemplate.exchange(
                            geminiUrl, HttpMethod.POST,
                            new HttpEntity<>(geminiBody.toString(), geminiHeaders), String.class);

                    JsonNode geminiJson = objectMapper.readTree(geminiResp.getBody());
                    reply = geminiJson.path("candidates").get(0).path("content").path("parts").get(0).path("text").asText("");
                    model = geminiModel;
                    promptTokens = geminiJson.path("usageMetadata").path("promptTokenCount").asInt(0);
                    completionTokens = geminiJson.path("usageMetadata").path("candidatesTokenCount").asInt(0);

                    if (!reply.isBlank()) {
                        logAiRequest(userDetails.getId(), model, promptTokens, completionTokens, topicName);
                        return ResponseEntity.ok(Map.of("reply", reply));
                    }
                } catch (Exception gemEx) {
                    log.warn("⚠️ [AI Tutor] Gemini failed ({}), falling back to Groq...", gemEx.getMessage());
                }
            }

            // ── 3. TERTIARY / FALLBACK: Groq Multi-Key Load Balancer ───────────
            log.info("🔌 [AI Tutor] Executing Groq Multi-Key Fallback...");
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("model", fastModel);
            payload.put("temperature", 0.1);
            payload.put("frequency_penalty", 0.2);
            payload.put("presence_penalty", 0.2);
            payload.put("max_tokens", 2000);

            ArrayNode messages = payload.putArray("messages");
            messages.addObject().put("role", "system").put("content", systemPrompt);

            int start = Math.max(0, history.size() - 6);
            for (int i = start; i < history.size(); i++) {
                Map<String, String> turn = history.get(i);
                String role = "assistant".equals(turn.get("role")) ? "assistant" : "user";
                messages.addObject().put("role", role).put("content", turn.getOrDefault("text", ""));
            }

            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");

            if (imagePath != null && !imagePath.isBlank()) {
                ArrayNode contentArray = userMsg.putArray("content");
                contentArray.addObject().put("type", "text").put("text", userMessage);
                String fullImageUrl = imagePath;
                if (!imagePath.startsWith("http://") && !imagePath.startsWith("https://")) {
                    fullImageUrl = "https://airgate.in" + (imagePath.startsWith("/") ? "" : "/") + imagePath;
                }
                ObjectNode imageBlock = contentArray.addObject();
                imageBlock.put("type", "image_url");
                imageBlock.putObject("image_url").put("url", fullImageUrl).put("detail", "low");
            } else {
                userMsg.put("content", userMessage);
            }

            int maxRetries = Math.max(3, groqKeyManager.getKeyCount() * 2);
            ResponseEntity<String> groqResp = null;

            for (int attempt = 1; attempt <= maxRetries; attempt++) {
                String keyToUse = groqKeyManager.getNextKey();
                if (keyToUse == null) break;

                try {
                    HttpHeaders headers = new HttpHeaders();
                    headers.setContentType(MediaType.APPLICATION_JSON);
                    headers.setBearerAuth(keyToUse);
                    HttpEntity<String> entity = new HttpEntity<>(payload.toString(), headers);
                    groqResp = restTemplate.exchange(GROQ_API_URL, HttpMethod.POST, entity, String.class);
                    if (groqResp.getStatusCode().is2xxSuccessful() && groqResp.getBody() != null) {
                        break;
                    }
                } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
                    log.warn("⚠️ [AI Tutor] Groq Rate Limit (429) on attempt {}! Marking key in 60s cooldown...", attempt);
                    groqKeyManager.markRateLimited(keyToUse);
                } catch (Exception ex) {
                    log.error("⚠️ [AI Tutor] Groq call failed on attempt {}: {}", attempt, ex.getMessage());
                }
            }

            if (groqResp != null && groqResp.getStatusCode().is2xxSuccessful() && groqResp.getBody() != null) {
                JsonNode json = objectMapper.readTree(groqResp.getBody());
                reply = json.path("choices").get(0).path("message").path("content").asText("I couldn't generate a reply. Please try again.");
                promptTokens = json.path("usage").path("prompt_tokens").asInt(0);
                completionTokens = json.path("usage").path("completion_tokens").asInt(0);
                model = json.path("model").asText(fastModel);

                logAiRequest(userDetails.getId(), model, promptTokens, completionTokens, topicName);
                return ResponseEntity.ok(Map.of("reply", reply));
            }

            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "AI Tutor is temporarily busy. All AI provider attempts failed. Please try again shortly."));

        } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
            log.warn("AI Tutor rate limit hit for user {}", userDetails.getUsername());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "AI Tutor is busy right now (rate limited). Please wait a moment and try again."));
        } catch (Exception e) {
            log.error("AI Tutor chat error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "AI Tutor encountered an error. Please try again shortly."));
        }
    }

    private void logAiRequest(Long userId, String modelName, int promptTokens, int completionTokens, String topicName) {
        try {
            com.pyq.platform.entity.User user = userRepository.findById(userId).orElse(null);
            if (user != null) {
                aiRequestRepository.save(com.pyq.platform.entity.AiRequest.builder()
                        .user(user)
                        .modelName(modelName)
                        .promptTokens(promptTokens)
                        .completionTokens(completionTokens)
                        .topicName(topicName)
                        .build());
            }
        } catch (Exception ex) {
            log.error("Failed to log AI request: {}", ex.getMessage());
        }
    }
}
