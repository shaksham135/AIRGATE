package com.pyq.platform.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pyq.platform.security.UserDetailsImpl;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/chat")
@Slf4j
public class AiTutorChatController {

    private static final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    @Value("${gemini.api.key.tutor:}")
    private String geminiTutorKey;  // PAID Gemini key — dedicated for AI Tutor only

    @Value("${gemini.model:gemini-2.5-flash}")
    private String geminiModel;     // Model to use for AI Tutor (same free-tier model)

    @Value("${groq.api.key:}")
    private String primaryKey;

    @Value("${groq.api.key.2:}")
    private String groqKey2;

    @Value("${groq.api.key.3:}")
    private String groqKey3;

    @Value("${groq.model.fast:llama-3.1-8b-instant}")
    private String fastModel;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private RestTemplate restTemplate;
    private final com.pyq.platform.repository.AiRequestRepository aiRequestRepository;
    private final com.pyq.platform.repository.UserRepository userRepository;
    private final com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository;

    public AiTutorChatController(com.pyq.platform.repository.AiRequestRepository aiRequestRepository,
                                 com.pyq.platform.repository.UserRepository userRepository,
                                 com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository) {
        this.aiRequestRepository = aiRequestRepository;
        this.userRepository = userRepository;
        this.systemSettingsRepository = systemSettingsRepository;
    }

    @PostConstruct
    public void init() {
        // Resolve Gemini tutor key from env if not set in properties
        if (geminiTutorKey == null || geminiTutorKey.isBlank()) {
            geminiTutorKey = System.getenv("GEMINI_API_KEY_TUTOR");
        }
        // Resolve Groq fallback key
        if (primaryKey == null || primaryKey.isBlank()) {
            primaryKey = System.getenv("GROQ_API_KEY");
        }
        if (groqKey2 == null || groqKey2.isBlank()) {
            groqKey2 = System.getenv("GROQ_API_KEY_2");
        }
        if (groqKey3 == null || groqKey3.isBlank()) {
            groqKey3 = System.getenv("GROQ_API_KEY_3");
        }

        org.springframework.http.client.SimpleClientHttpRequestFactory factory =
                new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(40000);
        this.restTemplate = new RestTemplate(factory);
    }

    /**
     * POST /api/chat/tutor
     * Premium-only endpoint. Sends a user message along with question context
     * to Groq and returns the AI tutor's reply.
     *
     * Request body:
     * {
     *   "message": "explain step 2",
     *   "questionText": "...",
     *   "questionType": "MCQ",
     *   "subjectName": "Operating Systems",
     *   "topicName": "CPU Scheduling",
     *   "suggestedAnswer": "B",
     *   "history": [ { "role": "user", "text": "..." }, { "role": "assistant", "text": "..." } ]
     * }
     */
    @PostMapping("/tutor")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> askTutor(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        // Check user status and determine daily limit
        boolean isPremium = userDetails != null && userDetails.isPremium();
        int dailyLimit = isPremium ? 50 : 3;

        // Load settings to fetch dynamically configured AI limit for premium users
        if (isPremium) {
            try {
                com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
                if (settings != null) {
                    dailyLimit = settings.getAiDailyLimitPremium();
                }
            } catch (Exception e) {
                // fallback to default premium limit
            }
        }

        // DB-backed daily rate limit — survives server restarts unlike in-memory buckets
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
                    + "1. Be highly concise, direct, and token-efficient. Max 2-3 short bullet points.\n"
                    + "2. Standard Markdown formatting (bold, inline code, formulas using $...$).\n"
                    + "3. DIAGRAM RULES: If asked for a diagram or flowchart, wrap the Mermaid definition STRICTLY inside standard backticks code block:\n"
                    + "   ```mermaid\n"
                    + "   graph LR\n"
                    + "   A --> B\n"
                    + "   ```\n"
                    + "   NEVER print raw 'graph LR' or mermaid text without the ```mermaid backticks fences!\n"
                    + "4. Answer accurately based on the question context below.\n\n"
                    + "QUESTION CONTEXT:\n"
                    + "- Type: " + questionType + "\n"
                    + "- Subject: " + subjectName + "\n"
                    + "- Topic: " + topicName + "\n"
                    + "- Question: " + questionText + "\n"
                    + "- Options: " + optionsText + "\n"
                    + "- Correct Answer: " + suggestedAnswer + "\n\n"
                    + "Help the student understand concisely step-by-step.";

            String reply;
            String model;
            int promptTokens = 0;
            int completionTokens = 0;

            // ── PRIMARY: Google Gemini 1.5 Flash (PAID tutor key) ────────────
            if (geminiTutorKey != null && !geminiTutorKey.isBlank()) {
                try {
                    log.info("🌟 [AI Tutor] Using Google Gemini (paid tutor key) as primary...");
                    ObjectNode geminiBody = objectMapper.createObjectNode();

                    // System instruction
                    ObjectNode sysInstruction = objectMapper.createObjectNode();
                    ArrayNode sysParts = objectMapper.createArrayNode();
                    sysParts.add(objectMapper.createObjectNode().put("text", systemPrompt));
                    sysInstruction.set("parts", sysParts);
                    geminiBody.set("systemInstruction", sysInstruction);

                    // Build contents from history + current message
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
                    // Current user message
                    ObjectNode curMsg = objectMapper.createObjectNode();
                    curMsg.put("role", "user");
                    ArrayNode curParts = objectMapper.createArrayNode();
                    curParts.add(objectMapper.createObjectNode().put("text", userMessage));
                    curMsg.set("parts", curParts);
                    contents.add(curMsg);
                    geminiBody.set("contents", contents);

                    ObjectNode genConfig = objectMapper.createObjectNode();
                    genConfig.put("temperature", 0.3);
                    genConfig.put("maxOutputTokens", 1000);
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
                        // Log AI request
                        try {
                            com.pyq.platform.entity.User user = userRepository.findById(userDetails.getId()).orElse(null);
                            if (user != null) {
                                aiRequestRepository.save(com.pyq.platform.entity.AiRequest.builder()
                                        .user(user).modelName(model).promptTokens(promptTokens)
                                        .completionTokens(completionTokens).topicName(topicName).build());
                            }
                        } catch (Exception ex) { log.error("Failed to log AI request: {}", ex.getMessage()); }
                        return ResponseEntity.ok(Map.of("reply", reply));
                    }
                } catch (Exception gemEx) {
                    log.warn("⚠️ [AI Tutor] Gemini failed ({}), falling back to Groq...", gemEx.getMessage());
                }
            }

            // ── FALLBACK: Groq ────────────────────────────────────────────────
            log.info("🔌 [AI Tutor] Falling back to Groq...");
            ObjectNode payload = objectMapper.createObjectNode();
            payload.put("model", fastModel);
            payload.put("temperature", 0.3);
            payload.put("max_tokens", 800);

            ArrayNode messages = payload.putArray("messages");
            ObjectNode sysMsg = messages.addObject();
            sysMsg.put("role", "system");
            sysMsg.put("content", systemPrompt);

            // Inject conversation history (last 6 turns max to save tokens)
            int start = Math.max(0, history.size() - 6);
            for (int i = start; i < history.size(); i++) {
                Map<String, String> turn = history.get(i);
                String role = "assistant".equals(turn.get("role")) ? "assistant" : "user";
                ObjectNode histMsg = messages.addObject();
                histMsg.put("role", role);
                histMsg.put("content", turn.getOrDefault("text", ""));
            }

            // Build Current User message with Multimodal Vision support (if Cloudinary image is attached)
            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");

            if (imagePath != null && !imagePath.isBlank()) {
                ArrayNode contentArray = userMsg.putArray("content");
                ObjectNode textBlock = contentArray.addObject();
                textBlock.put("type", "text");
                textBlock.put("text", userMessage);
                String fullImageUrl = imagePath;
                if (!imagePath.startsWith("http://") && !imagePath.startsWith("https://")) {
                    fullImageUrl = "https://airgate.in" + (imagePath.startsWith("/") ? "" : "/") + imagePath;
                }
                ObjectNode imageBlock = contentArray.addObject();
                imageBlock.put("type", "image_url");
                ObjectNode urlObj = imageBlock.putObject("image_url");
                urlObj.put("url", fullImageUrl);
                urlObj.put("detail", "low");
            } else {
                userMsg.put("content", userMessage);
            }

            // Rotate through all 3 Groq keys for fallback
            String groqFallbackKey = (primaryKey != null && !primaryKey.isBlank()) ? primaryKey
                    : (groqKey2 != null && !groqKey2.isBlank()) ? groqKey2
                    : groqKey3;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + groqFallbackKey);
            HttpEntity<String> entity = new HttpEntity<>(payload.toString(), headers);
            ResponseEntity<String> groqResp = restTemplate.exchange(GROQ_API_URL, HttpMethod.POST, entity, String.class);

            JsonNode json = objectMapper.readTree(groqResp.getBody());
            reply = json.path("choices").get(0).path("message").path("content").asText("I couldn't generate a reply. Please try again.");
            promptTokens = json.path("usage").path("prompt_tokens").asInt(0);
            completionTokens = json.path("usage").path("completion_tokens").asInt(0);
            model = json.path("model").asText(fastModel);

            // Log AI request for dashboard analytics
            try {
                com.pyq.platform.entity.User user = userRepository.findById(userDetails.getId()).orElse(null);
                if (user != null) {
                    aiRequestRepository.save(com.pyq.platform.entity.AiRequest.builder()
                            .user(user)
                            .modelName(model)
                            .promptTokens(promptTokens)
                            .completionTokens(completionTokens)
                            .topicName(topicName)
                            .build());
                }
            } catch (Exception ex) {
                log.error("Failed to log AI request: {}", ex.getMessage());
            }

            return ResponseEntity.ok(Map.of("reply", reply));

        } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
            log.warn("AI Tutor: Groq rate limit hit for user {}", userDetails.getUsername());
            return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                    .body(Map.of("error", "AI Tutor is busy right now (rate limited). Please wait a moment and try again."));
        } catch (Exception e) {
            log.error("AI Tutor chat error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "AI Tutor encountered an error. Please try again shortly."));
        }
    }
}
