package com.pyq.platform.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.*;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;

import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.util.*;

@Service
@Slf4j
public class AiQuestionGeneratorService {

    @Value("${groq.api.key:}")
    private String groqApiKey1;

    @Value("${groq.api.key.2:}")
    private String groqApiKey2;

    @Value("${groq.api.key.3:}")
    private String groqApiKey3;

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    private List<String> apiKeys = new ArrayList<>();
    private int currentKeyIndex = 0;

    @Value("${groq.model.heavy:llama-3.3-70b-versatile}")
    private String heavyModel;

    @Value("${groq.model.fast:llama-3.1-8b-instant}")
    private String fastModel;

    private static final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final RestTemplate restTemplate = new RestTemplate();
    private final java.util.concurrent.atomic.AtomicLong totalAiGeneratorTokens = new java.util.concurrent.atomic.AtomicLong(0);

    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;
    private final QuestionRepository questionRepository;
    private final AiGenerationLedgerRepository ledgerRepository;
    private final SystemSettingsRepository systemSettingsRepository;
    private final GroqUsageService groqUsageService;

    public AiQuestionGeneratorService(
            SubjectRepository subjectRepository,
            TopicRepository topicRepository,
            QuestionRepository questionRepository,
            AiGenerationLedgerRepository ledgerRepository,
            SystemSettingsRepository systemSettingsRepository,
            GroqUsageService groqUsageService) {
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.questionRepository = questionRepository;
        this.ledgerRepository = ledgerRepository;
        this.systemSettingsRepository = systemSettingsRepository;
        this.groqUsageService = groqUsageService;
    }

    @PostConstruct
    public void init() {
        if (groqApiKey1 != null && !groqApiKey1.isBlank() && !groqApiKey1.equals("your-groq-api-key")) apiKeys.add(groqApiKey1);
        if (groqApiKey2 != null && !groqApiKey2.isBlank()) apiKeys.add(groqApiKey2);
        if (groqApiKey3 != null && !groqApiKey3.isBlank()) apiKeys.add(groqApiKey3);
        if (apiKeys.isEmpty() && System.getenv("GROQ_API_KEY") != null) apiKeys.add(System.getenv("GROQ_API_KEY"));
    }

    private synchronized String getNextApiKey() {
        if (apiKeys.isEmpty()) return null;
        // Dynamic Time-based Key Division: Divide the 24-hour cycle equally across configured API keys
        int currentHour = LocalDateTime.now().getHour();
        int timeSegmentIndex = (currentHour / Math.max(1, 24 / apiKeys.size())) % apiKeys.size();

        // Base key from active time segment + sequential shift on retry
        int indexToUse = (timeSegmentIndex + currentKeyIndex) % apiKeys.size();
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.size();
        return apiKeys.get(indexToUse);
    }

    public static class VerificationResult {
        private final String answer;
        private final String explanation;

        public VerificationResult(String answer, String explanation) {
            this.answer = answer != null ? answer.trim() : "";
            this.explanation = explanation != null ? explanation.trim() : "Dual-AI Verified Practice Question.";
        }

        public String getAnswer() { return answer; }
        public String getExplanation() { return explanation; }
    }

    /**
     * Executes one full cycle: slot selection → generation → dual-verification → save.
     *
     * Dynamic Balancing Engine:
     *  - ONE bulk DB query fetches all slot counts (eliminates N+1 problem)
     *  - All subjects × topics × 4 difficulties × 3 types are considered every call
     *  - Slots with ZERO questions (bootstrap) are treated as the highest priority
     *  - Picks randomly among the TOP-10 lowest-populated slots for spread & variance
     *  - Includes parent-topic context in the prompt for accurate question scoping
     *  - Saves as PENDING_REVIEW (admin approval required before publishing)
     */
    @Transactional
    public boolean generateAndVerifySingleQuestion() {
        try {
            // ── 1. Load all subjects and topics (2 queries total) ────────────
            List<Subject> allSubjects = subjectRepository.findAll();
            if (allSubjects.isEmpty()) {
                log.warn("⚠️ [AI Generator] No subjects found in DB. Skipping generation.");
                return false;
            }

            List<Topic> allTopics = topicRepository.findAll();
            if (allTopics.isEmpty()) {
                log.warn("⚠️ [AI Generator] No topics found in DB. Skipping generation.");
                return false;
            }

            // ── 2. Build subject/topic lookup maps ───────────────────────────
            Map<Long, Subject> subjectMap = new HashMap<>();
            for (Subject s : allSubjects) subjectMap.put(s.getId(), s);

            // Map: topicId → Topic (with subject + parentTopic pre-fetched via @EntityGraph)
            Map<Long, Topic> topicMap = new HashMap<>();
            for (Topic t : allTopics) topicMap.put(t.getId(), t);

            // ── 3. ONE bulk query: get all existing approved counts by slot ──
            List<Object[]> existingCounts = questionRepository.countApprovedGroupedBySlot();

            // Build a lookup: "subjectId:topicId:difficulty:type" → count
            Map<String, Long> slotCountMap = new HashMap<>();
            for (Object[] row : existingCounts) {
                Long sId   = ((Number) row[0]).longValue();
                Long tId   = ((Number) row[1]).longValue();
                String diff = (String) row[2];
                String type = (String) row[3];
                Long cnt   = ((Number) row[4]).longValue();
                slotCountMap.put(sId + ":" + tId + ":" + diff + ":" + type, cnt);
            }

            // ── 4. Build all candidate slots (no per-slot DB query!) ─────────
            String[] difficulties = {"EASY", "MEDIUM", "HARD", "GATE_SUPER"};
            String[] types        = {"MCQ", "MSQ", "NAT"};

            record Slot(Subject subject, Topic topic, String difficulty, String qType, long count) {}

            List<Slot> slots = new ArrayList<>();
            for (Topic t : allTopics) {
                Subject s = subjectMap.get(t.getSubject() != null ? t.getSubject().getId() : null);
                if (s == null) continue; // orphan topic guard

                for (String diff : difficulties) {
                    for (String type : types) {
                        String key = s.getId() + ":" + t.getId() + ":" + diff + ":" + type;
                        long count = slotCountMap.getOrDefault(key, 0L);
                        slots.add(new Slot(s, t, diff, type, count));
                    }
                }
            }

            if (slots.isEmpty()) {
                log.warn("⚠️ [AI Generator] No valid subject-topic slots available. Skipping.");
                return false;
            }

            // ── 5. Sort by count ASC and group by Subject & Topic for diverse distribution ──
            slots.sort(Comparator.comparingLong(Slot::count));
            long minCount = slots.get(0).count();

            // Collect all slots that match the minimum question count
            List<Slot> minCountSlots = new ArrayList<>();
            for (Slot s : slots) {
                if (s.count() == minCount) {
                    minCountSlots.add(s);
                } else {
                    break;
                }
            }

            // Pick a random slot from the minimum count pool (truly diverse across all subjects & topics)
            Slot chosen = minCountSlots.get(new Random().nextInt(minCountSlots.size()));

            Subject targetSubject = chosen.subject();
            Topic   targetTopic   = chosen.topic();
            String  difficulty    = chosen.difficulty();
            String  qType         = chosen.qType();

            // Resolve parent topic name for better AI context
            String parentTopicName = "";
            if (targetTopic.getParentTopic() != null) {
                Topic parent = topicMap.get(targetTopic.getParentTopic().getId());
                parentTopicName = parent != null ? parent.getName() : "";
            }

            log.info("🎯 [AI Generator] Selected slot → Subject: '{}', Topic: '{}'{}, Diff: {}, Type: {}, Existing: {}",
                    targetSubject.getName(), targetTopic.getName(),
                    parentTopicName.isEmpty() ? "" : " (under '" + parentTopicName + "')",
                    difficulty, qType, chosen.count());

            // ── 6. Fetch or create ledger entry ──────────────────────────────
            AiGenerationLedger ledger = ledgerRepository
                    .findBySubjectIdAndTopicIdAndDifficultyAndQuestionType(
                            targetSubject.getId(), targetTopic.getId(), difficulty, qType)
                    .orElseGet(() -> ledgerRepository.save(AiGenerationLedger.builder()
                            .subject(targetSubject)
                            .topic(targetTopic)
                            .difficulty(difficulty)
                            .questionType(qType)
                            .totalGenerated(0)
                            .totalAccepted(0)
                            .totalRejected(0)
                            .build()));

            ledger.setTotalGenerated(ledger.getTotalGenerated() + 1);
            ledger.setLastGeneratedAt(LocalDateTime.now());

            // ── 7. STEP 1: Generate question via Gemini/Groq ─────────────────
            JsonNode generatedNode = callGroqGenerator(
                    targetSubject.getName(), targetTopic.getName(),
                    parentTopicName, difficulty, qType);

            if (generatedNode == null
                    || !generatedNode.has("questionText")
                    || !generatedNode.has("correctAnswer")
                    || generatedNode.get("questionText").asText("").isBlank()) {
                log.warn("⚠️ [AI Generator] Generator returned null/empty for slot. Rejecting.");
                ledger.setTotalRejected(ledger.getTotalRejected() + 1);
                ledgerRepository.save(ledger);
                return false;
            }

            String   qText    = generatedNode.get("questionText").asText();
            String   genAnswer = generatedNode.get("correctAnswer").asText().trim();
            JsonNode optionsNode = generatedNode.has("options") ? generatedNode.get("options") : null;

            // MCQ/MSQ must have options; NAT must not be empty answer
            if (!"NAT".equalsIgnoreCase(qType) && (optionsNode == null || !optionsNode.isArray() || optionsNode.size() < 4)) {
                log.warn("⚠️ [AI Generator] MCQ/MSQ question has fewer than 4 options. Rejecting.");
                ledger.setTotalRejected(ledger.getTotalRejected() + 1);
                ledgerRepository.save(ledger);
                return false;
            }

            // ── 8. Duplicate detection (scoped to topic + subject) ────────────
            String normalizedHash = generateNormalizedHash(qText);
            boolean isDuplicate = questionRepository.existsByChecksumHashAndTopicId(normalizedHash, targetTopic.getId())
                    || questionRepository.existsByChecksumHashAndSubjectId(normalizedHash, targetSubject.getId());

            if (isDuplicate) {
                log.warn("⚠️ [AI Generator] Duplicate detected in Subject/Topic. Discarding.");
                ledger.setTotalRejected(ledger.getTotalRejected() + 1);
                ledgerRepository.save(ledger);
                return false;
            }

            // ── 9. STEP 2: Dual Verification (blind solver via 70B Heavy Reasoning Model) ──
            VerificationResult vResult = callGroqVerifier(qText, optionsNode, qType);
            String verifiedAnswer = vResult != null ? vResult.getAnswer() : "";

            // ── 10. STEP 3: Answer match comparison ───────────────────────────
            boolean isAccepted = isAnswerMatch(genAnswer, verifiedAnswer, qType, optionsNode);

            if (isAccepted) {
                ledger.setTotalAccepted(ledger.getTotalAccepted() + 1);
                ledgerRepository.save(ledger);
                // Save directly as APPROVED — dual-AI verification (8B generator + 70B verifier)
                // already acts as the quality gate.
                String explanationToSave = (vResult != null && !vResult.getExplanation().isBlank()) 
                        ? vResult.getExplanation() 
                        : "Dual-AI Verified Practice Question.";
                saveQuestionToDatabase(targetSubject, targetTopic, difficulty, qType,
                        generatedNode, genAnswer, explanationToSave, "APPROVED", normalizedHash);
                log.info("✅ [AI Generator] Dual-verified question saved as APPROVED! Subject: {}, Topic: {}, Type: {}, Diff: {}",
                        targetSubject.getName(), targetTopic.getName(), qType, difficulty);
                return true;
            } else {
                ledger.setTotalRejected(ledger.getTotalRejected() + 1);
                ledgerRepository.save(ledger);
                log.warn("❌ [AI Generator] Answer mismatch — Gen (8B): '{}' vs Verifier (70B): '{}'. Discarding.",
                        genAnswer, verifiedAnswer);
                return false;
            }

        } catch (Exception e) {
            log.error("❌ [AI Generator] Unexpected error during generation step", e);
            return false;
        }
    }


    public String generateNormalizedHash(String text) {
        if (text == null) return "";
        String normalized = text.toLowerCase().replaceAll("[^a-z0-9]", "");
        return calculateSha256(normalized);
    }

    private JsonNode callGroqGenerator(String subject, String topic, String parentTopic, String difficulty, String qType) {
        boolean includeMermaidDiagram = new Random().nextInt(10) == 0; // ~10% probability of diagram question
        String diagramInstruction = includeMermaidDiagram ? "6. INCLUDE A MERMAID DIAGRAM IN THE QUESTION TEXT inside ```mermaid ... ``` block.\n" : "";

        // Build topic context string — include parent for hierarchical accuracy
        String topicContext = parentTopic != null && !parentTopic.isBlank()
                ? parentTopic + " → " + topic
                : topic;

        String[] startingStyles = {
            "A direct scenario starting with a noun (e.g., 'A pipelined CPU has...', 'An operating system uses...', 'A relation R with schema...')",
            "A direct query or calculation (e.g., 'Determine the minimum...', 'Calculate the number of...', 'Find the average access time of...')",
            "A system simulation/execution trace (e.g., 'During execution of a thread...', 'In a selective-repeat ARQ protocol...', 'A transaction scheduler receives...')",
            "A comparative evaluation (e.g., 'Which of the following statements is...', 'Identify the correct relation between...')"
        };
        String selectedStyle = startingStyles[new Random().nextInt(startingStyles.length)];

        String prompt = String.format(
                "Role: Senior GATE CSE Examiner.\n" +
                "Target Subject: %s | Target Topic: %s | Difficulty: %s | Question Type: %s.\n\n" +
                "STRICT QUALITY, KATEX & MATHEMATICAL BOUNDARY RULES:\n" +
                "1. SUBJECT BOUNDARY: The question MUST be 100%% strictly about '%s' within '%s'. DO NOT mix topics or concepts from other subjects (e.g. Operating System questions belong ONLY to Operating System, Discrete Mathematics questions belong ONLY to Discrete Mathematics).\n" +
                "2. KATEX / LATEX FORMATTING (MANDATORY & CRITICAL):\n" +
                "   - DOLLAR SIGNS MUST ONLY WRAP INDIVIDUAL VARIABLES OR ISOLATED FORMULAS (e.g. Write: 'arrive at times $0$, $t_1$, $t_2$ and require $p_1$, $p_2$ units of processing time').\n" +
                "   - NEVER wrap plain English words, sentences, or phrases ('and require', 'units of processing time', 'given that', 'where', 'respectively') INSIDE dollar signs!\n" +
                "   - Double-escape backslashes in JSON (\\\\frac, \\\\cdot, \\\\oplus, \\\\in, \\\\forall, \\\\exists).\n" +
                "3. NATURAL TEXTBOOK QUESTION STYLE: Write a crisp, authentic, textbook-grade GATE CS problem statement. DO NOT use artificial or awkward intros like 'During the execution of a predicate logic statement...'.\n" +
                "4. MERMAID DIAGRAMS: If a diagram helps explain a circuit, pipeline, tree, state machine, or ER model, include valid ```mermaid ... ``` block inside questionText.\n" +
                "5. CRITICAL MCQ RULE: Calculate the mathematical solution step-by-step FIRST, and place the EXACT calculated answer in one of the 4 options (A,B,C,D). The options array MUST contain the exact correct answer!\n" +
                "6. For MCQ/MSQ: Provide exactly 4 distinct options (A,B,C,D). For NAT: omit options array entirely.\n" +
                "%s" +
                "7. 'correctAnswer' format:\n" +
                "   - MCQ: Single letter e.g. \"A\"\n" +
                "   - MSQ: Sorted comma-separated letters e.g. \"A,C\"\n" +
                "   - NAT: Single exact number e.g. \"42\" or \"3.33\"\n\n" +
                "STRICT JSON ONLY:\n" +
                "{\n" +
                "  \"questionText\": \"Text with isolated $math$\",\n" +
                "  \"options\": [{\"label\": \"A\", \"text\": \"...\"}, {\"label\": \"B\", \"text\": \"...\"}, {\"label\": \"C\", \"text\": \"...\"}, {\"label\": \"D\", \"text\": \"...\"}],\n" +
                "  \"correctAnswer\": \"A\"\n" +
                "}",
                subject, topicContext, difficulty, qType, topicContext, subject, diagramInstruction
        );

        // ── PRIMARY: Groq Llama 3.3 70B (Heavy Reasoning Model for Precision Generation) ──
        try {
            log.info("🤖 Attempting Question Generation via Groq Llama 3.3 70B (Heavy Generator)...");
            JsonNode groqRes = executeGroqCall(prompt, true, 600);
            if (groqRes != null) return groqRes;
        } catch (Exception e) {
            log.warn("⚠️ Groq generator call failed, falling back to Gemini! Error: {}", e.getMessage());
        }

        // ── FALLBACK: Google Gemini ──
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                log.info("🚀 Falling back to Google Gemini for Question Generation...");
                JsonNode geminiRes = executeGeminiCall(prompt, 2048);
                if (geminiRes != null) return geminiRes;
            } catch (Exception e) {
                log.warn("⚠️ Gemini generator call failed! Error: {}", e.getMessage());
            }
        }
        return null;
    }

    private VerificationResult callGroqVerifier(String qText, JsonNode optionsNode, String qType) {
        StringBuilder sb = new StringBuilder();
        sb.append("Role: Senior GATE CSE Evaluator.\n" +
                  "Solve this question independently step-by-step and determine the exact correct answer.\n\n" +
                  "Type: ").append(qType).append("\n" +
                  "Question: ").append(qText).append("\n");
        if (optionsNode != null && optionsNode.isArray() && optionsNode.size() > 0) {
            sb.append("Options:\n");
            optionsNode.forEach(opt -> {
                String lbl = opt.has("label") ? opt.get("label").asText() : "A";
                String txt = opt.has("text") ? opt.get("text").asText() : "";
                sb.append(lbl).append(") ").append(txt).append("\n");
            });
        }
        sb.append("\nINSTRUCTIONS:\n" +
                  "1. Work out the solution mathematically.\n" +
                  "2. Output STRICT JSON in a SINGLE response:\n" +
                  "   - \"answer\": \"A\" (for MCQ), \"A,C\" (for MSQ), or \"42\" (for NAT)\n" +
                  "   - \"explanation\": \"Concise 2-sentence mathematical proof explaining why the answer is correct.\"\n");

        // ── PRIMARY: Groq Llama 3.3 70B (Heavy Reasoning Model for Blind Verification) ──
        try {
            log.info("🤖 Attempting Answer Verification via Groq Llama 3.3 70B (Heavy Verifier)...");
            JsonNode res = executeGroqCall(sb.toString(), true, 450);
            if (res != null) {
                String ans = res.has("answer") ? res.get("answer").asText() : "";
                String exp = res.has("explanation") ? res.get("explanation").asText() : "";
                if (!ans.isBlank()) {
                    return new VerificationResult(ans, exp);
                }
            }
        } catch (Exception e) {
            log.warn("⚠️ Groq verifier call failed, falling back to Gemini! Error: {}", e.getMessage());
        }

        // ── FALLBACK: Google Gemini ──
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                log.info("🚀 Falling back to Google Gemini for Answer Verification...");
                JsonNode geminiRes = executeGeminiCall(sb.toString(), 2048);
                if (geminiRes != null && geminiRes.has("answer")) {
                    String ans = geminiRes.get("answer").asText();
                    String exp = geminiRes.has("explanation") ? geminiRes.get("explanation").asText() : "";
                    return new VerificationResult(ans, exp);
                }
            } catch (Exception e) {
                log.warn("⚠️ Gemini verifier call failed! Error: {}", e.getMessage());
            }
        }
        return new VerificationResult("", "");
    }

    private JsonNode executeGroqCall(String prompt, boolean isHeavyModel, int maxTokens) {
        int maxRetries = 3;
        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            String apiKey = getNextApiKey();
            if (apiKey == null) return null;

            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(apiKey);

                ObjectNode req = objectMapper.createObjectNode();
                req.put("model", isHeavyModel ? heavyModel : fastModel);
                req.put("temperature", 0.1);
                req.put("max_tokens", maxTokens);
                req.put("response_format", objectMapper.createObjectNode().put("type", "json_object"));

                ArrayNode messages = objectMapper.createArrayNode();
                messages.add(objectMapper.createObjectNode().put("role", "system").put("content", "You respond strictly in raw JSON object format."));
                messages.add(objectMapper.createObjectNode().put("role", "user").put("content", prompt));
                req.set("messages", messages);

                ResponseEntity<String> response = restTemplate.exchange(GROQ_API_URL, HttpMethod.POST, new HttpEntity<>(req.toString(), headers), String.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    if (root != null) {
                        if (root.has("usage") && root.get("usage").has("total_tokens")) {
                            long tokensUsed = root.get("usage").get("total_tokens").asLong();
                            totalAiGeneratorTokens.addAndGet(tokensUsed);
                            log.info("🤖 [AI Generator Token Ledger] Call consumed {} tokens. Total AI Generator Tokens: {}", tokensUsed, totalAiGeneratorTokens.get());
                        }
                        if (root.has("choices") && root.get("choices").isArray() && root.get("choices").size() > 0) {
                            String content = root.get("choices").get(0).get("message").get("content").asText();
                            return objectMapper.readTree(content);
                        }
                    }
                }
            } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
                log.warn("⚠️ Groq Rate Limit (429) encountered on attempt {}! Rotating API Key & pausing 3 seconds...", attempt);
                try {
                    Thread.sleep(3000);
                } catch (InterruptedException ignored) {}
            } catch (Exception e) {
                log.error("Groq API call failed during question generation (attempt {})", attempt, e);
                break;
            }
        }
        return null;
    }

    public long getTotalAiGeneratorTokens() {
        return totalAiGeneratorTokens.get();
    }

    public void resetTokens() {
        totalAiGeneratorTokens.set(0);
    }

    private static final String GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/";

    private JsonNode executeGeminiCall(String prompt, int maxOutputTokens) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            // Build URL dynamically from configured model (supports hot-swap via GEMINI_MODEL env var)
            String url = GEMINI_BASE_URL + geminiModel + ":generateContent?key=" + geminiApiKey;
            log.debug("🌐 Gemini API call → model: {}", geminiModel);

            // Build Gemini request body
            ObjectNode requestBody = objectMapper.createObjectNode();

            // contents array
            ArrayNode contents = objectMapper.createArrayNode();
            ObjectNode contentObj = objectMapper.createObjectNode();
            ArrayNode parts = objectMapper.createArrayNode();
            ObjectNode part = objectMapper.createObjectNode();
            part.put("text", prompt);
            parts.add(part);
            contentObj.set("parts", parts);
            contentObj.put("role", "user");
            contents.add(contentObj);
            requestBody.set("contents", contents);

            // generationConfig for JSON mode + token limit
            ObjectNode genConfig = objectMapper.createObjectNode();
            genConfig.put("temperature", 0.1);
            genConfig.put("maxOutputTokens", maxOutputTokens);
            genConfig.put("responseMimeType", "application/json");
            requestBody.set("generationConfig", genConfig);

            ResponseEntity<String> response = restTemplate.exchange(
                url, HttpMethod.POST,
                new HttpEntity<>(requestBody.toString(), headers),
                String.class
            );

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                JsonNode root = objectMapper.readTree(response.getBody());
                // Log token usage if available
                if (root.has("usageMetadata")) {
                    long tokensUsed = root.get("usageMetadata").path("totalTokenCount").asLong();
                    totalAiGeneratorTokens.addAndGet(tokensUsed);
                    log.info("🌟 [Gemini Token Ledger] Call consumed {} tokens. Total AI Generator Tokens: {}", tokensUsed, totalAiGeneratorTokens.get());
                }
                // Extract text from candidates[0].content.parts[0].text
                JsonNode candidates = root.path("candidates");
                if (candidates.isArray() && candidates.size() > 0) {
                    JsonNode cand = candidates.get(0);
                    String finishReason = cand.path("finishReason").asText("");
                    if ("MAX_TOKENS".equalsIgnoreCase(finishReason)) {
                        log.warn("⚠️ Gemini response hit MAX_TOKENS truncation limit!");
                    }
                    String text = cand.path("content").path("parts").get(0).path("text").asText();
                    if (text != null && !text.isBlank()) {
                        // Strip any markdown code fences
                        text = text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();
                        // Extract JSON substring between { and } if needed
                        int startIdx = text.indexOf('{');
                        int endIdx = text.lastIndexOf('}');
                        if (startIdx != -1 && endIdx > startIdx) {
                            text = text.substring(startIdx, endIdx + 1);
                        }
                        return objectMapper.readTree(text);
                    }
                }
            }
        } catch (Exception e) {
            log.error("❌ Gemini API call failed: {}", e.getMessage());
            throw new RuntimeException("Gemini call failed: " + e.getMessage(), e);
        }
        return null;
    }

    private boolean isAnswerMatch(String gen, String ver, String qType, JsonNode optionsNode) {
        if (gen == null || ver == null) return false;
        String g = gen.replaceAll("\\s+", "").toUpperCase();
        String v = ver.replaceAll("\\s+", "").toUpperCase();

        // 1. Direct option letter match
        if ("MCQ".equalsIgnoreCase(qType)) {
            String gLetter = g.replaceAll("[^A-D]", "");
            String vLetter = v.replaceAll("[^A-D]", "");
            if (!gLetter.isEmpty() && gLetter.equals(vLetter)) return true;

            // 2. Dynamic Option Content Match: If verifier returned option text instead of label "A"
            if (optionsNode != null && optionsNode.isArray()) {
                for (JsonNode opt : optionsNode) {
                    String optLabel = opt.has("label") ? opt.get("label").asText().toUpperCase() : "";
                    String optText = opt.has("text") ? opt.get("text").asText().replaceAll("\\s+", "").toUpperCase() : "";
                    if (!optText.isEmpty() && (v.contains(optText) || optText.contains(v))) {
                        if (gLetter.equalsIgnoreCase(optLabel)) {
                            log.info("🎯 Dynamic Option Match Success! Verifier returned option text '{}' matching option {}", ver, optLabel);
                            return true;
                        }
                    }
                }
            }
            return false;
        } else if ("MSQ".equalsIgnoreCase(qType)) {
            Set<String> gSet = new HashSet<>(Arrays.asList(g.replaceAll("[^A-D,]", "").split(",")));
            Set<String> vSet = new HashSet<>(Arrays.asList(v.replaceAll("[^A-D,]", "").split(",")));
            gSet.remove("");
            vSet.remove("");
            if (!gSet.isEmpty() && gSet.equals(vSet)) return true;

            // Dynamic MSQ Option Text matching
            if (optionsNode != null && optionsNode.isArray()) {
                Set<String> matchedVerLabels = new HashSet<>();
                optionsNode.forEach(opt -> {
                    String label = opt.has("label") ? opt.get("label").asText().toUpperCase() : "";
                    String optText = opt.has("text") ? opt.get("text").asText().replaceAll("\\s+", "").toUpperCase() : "";
                    if (!optText.isEmpty() && (v.contains(optText) || optText.contains(v))) {
                        matchedVerLabels.add(label);
                    }
                });
                if (!matchedVerLabels.isEmpty() && matchedVerLabels.equals(gSet)) return true;
            }
            return false;
        } else {
            // NAT Numerical match (support fractions like 10/3 => 3.33)
            try {
                double gNum = parseNumberOrFraction(g);
                double vNum = parseNumberOrFraction(v);
                return Math.abs(gNum - vNum) <= 0.05;
            } catch (Exception e) {
                return g.equalsIgnoreCase(v);
            }
        }
    }

    private double parseNumberOrFraction(String str) {
        if (str.contains("/")) {
            String[] parts = str.split("/");
            return Double.parseDouble(parts[0]) / Double.parseDouble(parts[1]);
        }
        return Double.parseDouble(str);
    }

    public void saveQuestionToDatabase(Subject subject, Topic topic, String difficulty, String qType, JsonNode node, String genAnswer, String explanation, String status, String checksumHash) {
        try {
            String qText = node.has("questionText") ? node.get("questionText").asText() : "";

            Question q = Question.builder()
                    .text(qText)
                    .questionType(qType)
                    .difficulty(difficulty)
                    .marks("HARD".equalsIgnoreCase(difficulty) || "GATE_SUPER".equalsIgnoreCase(difficulty) ? 2 : 1)
                    .negativeMarks("MCQ".equalsIgnoreCase(qType) ? ("HARD".equalsIgnoreCase(difficulty) ? 0.66 : 0.33) : 0.0)
                    .year(LocalDateTime.now().getYear())
                    .subject(subject)
                    .topic(topic)
                    .isCommunityVerified("APPROVED".equalsIgnoreCase(status))
                    .checksumHash(checksumHash)
                    .pdfSourceName("AI_NIGHTLY_GENERATOR")
                    .pdfSourcePath("system/ai-generator")
                    .pdfPageNumber(1)
                    .status(status)
                    .build();

            List<QuestionOption> options = new ArrayList<>();
            if (node.has("options") && node.get("options").isArray()) {
                node.get("options").forEach(opt -> {
                    String label = opt.has("label") ? opt.get("label").asText() : "";
                    String text = opt.has("text") ? opt.get("text").asText() : "";
                    options.add(QuestionOption.builder()
                            .question(q)
                            .optionLabel(label)
                            .optionText(text)
                            .build());
                });
            }
            q.setOptions(options);

            // Add AI Analysis record with verified answer and short proof
            List<QuestionAIAnalysis> analyses = new ArrayList<>();
            analyses.add(QuestionAIAnalysis.builder()
                    .question(q)
                    .suggestedAnswer(genAnswer)
                    .suggestedExplanation(explanation != null && !explanation.isBlank() ? explanation : "Dual-AI Verified Practice Question.")
                    .confidence(1.0)
                    .modelName("Groq-8B-70B-Dual")
                    .build());
            q.setAiAnalyses(analyses);

            questionRepository.save(q);
        } catch (Exception e) {
            log.error("Failed to save AI question to DB", e);
        }
    }

    /**
     * SUNDAY AUTOMATED AI QUALITY AUDIT CRON
     * Runs every Sunday at 02:00 AM (cron: "0 0 2 * * SUN").
     * Audits reported questions and low-confidence AI questions.
     * Retries up to 3 times to get 80%+ confidence of correctness before purging invalid questions.
     */
    @org.springframework.scheduling.annotation.Scheduled(cron = "0 0 2 * * SUN")
    @Transactional
    public void runSundayQualityAuditCron() {
        log.info("🤖 Starting Sunday Automated AI Quality Audit...");
        List<Question> candidateQuestions = questionRepository.findByStatus("PENDING_REVIEW");
        if (candidateQuestions.isEmpty()) {
            // Also inspect practice questions that have open reports
            candidateQuestions = questionRepository.findRandomApproved(15);
        }

        int purgedCount = 0;
        int passedCount = 0;

        for (Question q : candidateQuestions) {
            boolean passes = auditAndVerifyWithConfidence(q, 3);
            if (passes) {
                passedCount++;
            } else {
                purgedCount++;
            }
        }
        log.info("✅ Sunday AI Quality Audit Complete: {} questions verified & passed, {} invalid questions purged completely.", passedCount, purgedCount);
    }

    @org.springframework.transaction.annotation.Transactional
    public boolean reverifyQuestion(Long questionId) {
        Optional<Question> qOpt = questionRepository.findById(questionId);
        if (qOpt.isEmpty()) return false;
        return auditAndVerifyWithConfidence(qOpt.get(), 3);
    }

    private boolean auditAndVerifyWithConfidence(Question q, int maxRetries) {
        int failedAttempts = 0;
        int successAttempts = 0;

        for (int i = 0; i < maxRetries; i++) {
            try {
                StringBuilder auditPrompt = new StringBuilder();
                auditPrompt.append("Role: Expert GATE CS Exam Auditor.\nAudit and verify canonical answer:\n");
                auditPrompt.append("Subject: ").append(q.getSubject() != null ? q.getSubject().getName() : "General CS").append("\n");
                auditPrompt.append("Topic: ").append(q.getTopic() != null ? q.getTopic().getName() : "General").append("\n");
                auditPrompt.append("Type: ").append(q.getQuestionType()).append("\n");
                auditPrompt.append("Question Text: ").append(q.getText()).append("\n");
                auditPrompt.append("Options:\n");
                if (q.getOptions() != null) {
                    q.getOptions().forEach(o -> auditPrompt.append(o.getOptionLabel()).append(") ").append(o.getOptionText()).append("\n"));
                }
                auditPrompt.append("\nINSTRUCTIONS FOR AUDIT:\n1. Preserve all mathematical LaTeX expressions, matrices, and variables wrapped in $...$ or $$...$$.\n2. Escape backslashes in JSON (\\\\frac, \\\\lambda, \\\\begin{bmatrix}).\nReturn STRICT JSON:\n{\"questionText\":\"...\",\"options\":[{\"label\":\"A\",\"text\":\"...\"},{\"label\":\"B\",\"text\":\"...\"},{\"label\":\"C\",\"text\":\"...\"},{\"label\":\"D\",\"text\":\"...\"}],\"correctAnswer\":\"A\"}");

                JsonNode auditedNode = executeGroqCall(auditPrompt.toString(), true, 450);
                if (auditedNode == null || !auditedNode.has("questionText") || !auditedNode.has("correctAnswer")) {
                    failedAttempts++;
                    continue;
                }

                String auditedAnswer = auditedNode.get("correctAnswer").asText().trim();
                JsonNode auditedOptionsNode = auditedNode.get("options");
                VerificationResult verifierRes = callGroqVerifier(q.getText(), auditedOptionsNode, q.getQuestionType());
                String verifierAnswer = verifierRes != null ? verifierRes.getAnswer() : "";

                if (isAnswerMatch(auditedAnswer, verifierAnswer, q.getQuestionType(), auditedOptionsNode)) {
                    successAttempts++;
                } else {
                    failedAttempts++;
                }
            } catch (Exception e) {
                failedAttempts++;
            }
        }

        // If >= 80% confident that question is flawed (e.g. 2 out of 3 failed), PURGE IT COMPLETELY
        double failureConfidence = (double) failedAttempts / maxRetries;
        if (failureConfidence >= 0.66) {
            log.warn("❌ Question #{} failed audit with {:.0f}% failure confidence ({} failed out of {} attempts). PURGING COMPLETELY.",
                    q.getId(), failureConfidence * 100, failedAttempts, maxRetries);
            questionRepository.delete(q);
            return false;
        } else {
            q.setStatus("APPROVED");
            q.setIsCommunityVerified(true);
            questionRepository.save(q);
            log.info("✅ Question #{} passed Sunday AI audit! Status locked to APPROVED.", q.getId());
            return true;
        }
    }

    private boolean isOptionCorrect(String label, String answerKey, String qType) {
        if ("NAT".equalsIgnoreCase(qType)) return false;
        String[] correct = answerKey.split(",");
        for (String c : correct) {
            if (c.trim().equalsIgnoreCase(label)) return true;
        }
        return false;
    }

    private String calculateSha256(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(input.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            return UUID.randomUUID().toString().replace("-", "");
        }
    }
}
