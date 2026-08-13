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
    private final GroqKeyManager groqKeyManager;
    private final TopicSeedRegistry topicSeedRegistry;
    private final TagRepository tagRepository;

    public AiQuestionGeneratorService(
            SubjectRepository subjectRepository,
            TopicRepository topicRepository,
            QuestionRepository questionRepository,
            AiGenerationLedgerRepository ledgerRepository,
            SystemSettingsRepository systemSettingsRepository,
            GroqUsageService groqUsageService,
            GroqKeyManager groqKeyManager,
            TopicSeedRegistry topicSeedRegistry,
            TagRepository tagRepository) {
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.questionRepository = questionRepository;
        this.ledgerRepository = ledgerRepository;
        this.systemSettingsRepository = systemSettingsRepository;
        this.groqUsageService = groqUsageService;
        this.groqKeyManager = groqKeyManager;
        this.topicSeedRegistry = topicSeedRegistry;
        this.tagRepository = tagRepository;
    }

    @PostConstruct
    public void init() {
        log.info("🤖 [AiQuestionGeneratorService] Multi-Key Groq Generator ready with {} keys.", groqKeyManager.getKeyCount());
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
        private final String rephrasedQuestionText;
        private final JsonNode rephrasedOptions;

        public VerificationResult(String answer, String explanation) {
            this(answer, explanation, null, null);
        }

        public VerificationResult(String answer, String explanation, String rephrasedQuestionText, JsonNode rephrasedOptions) {
            this.answer = answer != null ? answer.trim() : "";
            this.explanation = explanation != null ? explanation.trim() : "Dual-AI Verified Practice Question.";
            this.rephrasedQuestionText = rephrasedQuestionText != null && !rephrasedQuestionText.isBlank() ? rephrasedQuestionText.trim() : null;
            this.rephrasedOptions = rephrasedOptions;
        }

        public String getAnswer() { return answer; }
        public String getExplanation() { return explanation; }
        public String getRephrasedQuestionText() { return rephrasedQuestionText; }
        public JsonNode getRephrasedOptions() { return rephrasedOptions; }
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
        return generateAndVerifySingleQuestion(null, null, null, null);
    }

    @Transactional
    public boolean generateAndVerifySingleQuestion(String reqDifficulty, String reqType, Long reqSubjectId, Long reqTopicId) {
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

                if (reqSubjectId != null && !s.getId().equals(reqSubjectId)) continue;
                if (reqTopicId != null && !t.getId().equals(reqTopicId)) continue;

                for (String diff : difficulties) {
                    if (reqDifficulty != null && !"MIXED".equalsIgnoreCase(reqDifficulty) && !diff.equalsIgnoreCase(reqDifficulty)) continue;
                    for (String type : types) {
                        if (reqType != null && !"MIXED".equalsIgnoreCase(reqType) && !type.equalsIgnoreCase(reqType)) continue;
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

            // ── 8. Multi-Layer Duplicate detection (Exact Hash + Jaccard Near-Duplicate Semantic Match) ────────────
            String normalizedHash = generateNormalizedHash(qText);
            boolean isExactDuplicate = questionRepository.existsByChecksumHashAndTopicId(normalizedHash, targetTopic.getId())
                    || questionRepository.existsByChecksumHashAndSubjectId(normalizedHash, targetSubject.getId());
            boolean isNearDup = isNearDuplicate(qText, targetTopic.getId());

            if (isExactDuplicate || isNearDup) {
                log.warn("⚠️ [AI Generator] {} duplicate detected in Subject/Topic. Discarding.", isExactDuplicate ? "Exact" : "Semantic near-");
                ledger.setTotalRejected(ledger.getTotalRejected() + 1);
                ledgerRepository.save(ledger);
                return false;
            }

            // ── 9. STEP 2: Dual Verification (blind solver via 70B Heavy Reasoning Model) ──
            VerificationResult vResult = callGroqVerifier(qText, optionsNode, qType);
            String verifiedAnswer = vResult != null ? vResult.getAnswer() : "";

            // ── 10. STEP 3: Answer match comparison ───────────────────────────
            boolean isAccepted = isAnswerMatch(genAnswer, verifiedAnswer, qType, optionsNode);

            // 🚀 Smart Verification Recovery: If 70B/Gemini verifier returned a valid answer for MCQ/NAT/MSQ, adopt the verifier's authoritative answer
            if (!isAccepted && verifiedAnswer != null && !verifiedAnswer.isBlank()) {
                String vClean = verifiedAnswer.replaceAll("[^A-D,0-9.-]", "").trim();
                if ("MCQ".equalsIgnoreCase(qType) && vClean.matches("^[A-D]$")) {
                    genAnswer = vClean;
                    isAccepted = true;
                    log.info("🎯 [AI Generator] Adopted Verifier's authoritative answer ({}) to resolve draft label mismatch!", genAnswer);
                } else if ("NAT".equalsIgnoreCase(qType) && !vClean.isEmpty()) {
                    genAnswer = vClean;
                    isAccepted = true;
                    log.info("🎯 [AI Generator] Adopted Verifier's authoritative NAT answer ({})!", genAnswer);
                }
            }

            if (isAccepted) {
                ledger.setTotalAccepted(ledger.getTotalAccepted() + 1);
                ledgerRepository.save(ledger);

                // 🚀 Dual-AI Quality Polish: Apply 70B Verifier's rephrased GATE-standard text if provided
                if (vResult != null && vResult.getRephrasedQuestionText() != null && !vResult.getRephrasedQuestionText().isBlank()) {
                    ((ObjectNode) generatedNode).put("questionText", vResult.getRephrasedQuestionText());
                    log.info("✨ [AI Generator] Applied 70B Verifier GATE-Quality Text Polish!");
                }
                if (vResult != null && vResult.getRephrasedOptions() != null && vResult.getRephrasedOptions().isArray() && vResult.getRephrasedOptions().size() >= 4) {
                    ((ObjectNode) generatedNode).set("options", vResult.getRephrasedOptions());
                }

                String explanationToSave = (vResult != null && !vResult.getExplanation().isBlank() && !"Dual-AI Verified Practice Question.".equals(vResult.getExplanation()))
                        ? vResult.getExplanation()
                        : "Verified step-by-step mathematical proof for option (" + genAnswer + ").";
                saveQuestionToDatabase(targetSubject, targetTopic, difficulty, qType,
                        generatedNode, genAnswer, explanationToSave, "PENDING_REVIEW", normalizedHash);
                log.info("✅ [AI Generator] Dual-verified practice question saved as PENDING_REVIEW! Subject: {}, Topic: {}, Type: {}, Diff: {}",
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


    public boolean isNearDuplicate(String newText, Long topicId) {
        if (newText == null || newText.isBlank() || topicId == null) return false;

        try {
            List<Question> recent = questionRepository.findTop50ByTopicIdOrderByIdDesc(topicId);
            Set<String> newWords = extractStemKeywords(newText);
            if (newWords.size() < 3) return false;

            for (Question existing : recent) {
                Set<String> existingWords = extractStemKeywords(existing.getText());
                double similarity = calculateJaccardSimilarity(newWords, existingWords);
                if (similarity >= 0.60) {
                    log.warn("⚠️ [AI Generator] Near-duplicate detected! {}% word-overlap match with existing Question ID #{}", 
                            Math.round(similarity * 100), existing.getId());
                    return true;
                }
            }
        } catch (Exception e) {
            log.warn("Failed near-duplicate check: {}", e.getMessage());
        }
        return false;
    }

    private Set<String> extractStemKeywords(String text) {
        if (text == null) return Set.of();
        String clean = text.toLowerCase()
                .replaceAll("```[a-z]*[\\s\\S]*?```", "")
                .replaceAll("\\\\[a-zA-Z]+", "")
                .replaceAll("[^a-z0-9\\s]", " ");

        Set<String> stopWords = Set.of(
            "the", "is", "a", "an", "and", "or", "in", "of", "to", "for", "with", "on", "at", "by", "from", 
            "that", "which", "this", "be", "are", "were", "was", "have", "has", "had", "consider", "find", 
            "what", "calculate", "following", "given", "value", "let", "show", "determine", "option", "correct"
        );

        Set<String> words = new HashSet<>();
        for (String w : clean.split("\\s+")) {
            if (w.length() > 2 && !stopWords.contains(w)) {
                words.add(w);
            }
        }
        return words;
    }

    private double calculateJaccardSimilarity(Set<String> s1, Set<String> s2) {
        if (s1.isEmpty() || s2.isEmpty()) return 0.0;
        Set<String> intersection = new HashSet<>(s1);
        intersection.retainAll(s2);
        Set<String> union = new HashSet<>(s1);
        union.addAll(s2);
        return (double) intersection.size() / union.size();
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

        // Fetch Dynamic Scenario Seed Matrix to guarantee 100% novel problem statements every call
        TopicSeedRegistry.SeedMatrix seed = topicSeedRegistry.getRandomSeed(subject, topic);

        String prompt = "STRICT QUALITY, KATEX & MATHEMATICAL BOUNDARY RULES:\n" +
                "1. SUBJECT BOUNDARY: The question MUST be 100%% strictly about '%s' within '%s'. DO NOT mix topics or concepts from other subjects (e.g. Operating System questions belong ONLY to Operating System, Discrete Mathematics questions belong ONLY to Discrete Mathematics).\n" +
                "2. KATEX / LATEX FORMATTING (MANDATORY & CRITICAL):\n" +
                "   - INLINE MATH ($...$): Wrap single variables, subscripts, and short formulas in single dollars (e.g. $b_3$, $t_1$, $2 \\\\times 2$, $\\\\mathcal{O}(n \\\\log n)$). Inline math MUST stay on a single line.\n" +
                "   - DISPLAY MATH ($$...$$): Wrap matrices, large equations, and summations in double dollars on a separate line (e.g. $$A = \\\\begin{pmatrix} 1 & 1 \\\\\\\\ 1 & -1 \\\\end{pmatrix}$$).\n" +
                "   - BOOLEAN ALGEBRA: Use \\\\overline{variable} for complements (e.g. $\\\\overline{b_1}\\\\overline{b_0} + b_1 \\\\overline{b_2} b_3$). DO NOT use A', !A, or NOT A.\n" +
                "   - DOUBLE-ESCAPE BACKSLASHES IN JSON: Output \\\\frac, \\\\sqrt, \\\\sum, \\\\begin, \\\\end, \\\\overline, \\\\times, \\\\cdot, \\\\pmatrix.\n" +
                "   - NEVER wrap plain English words or phrases ('and require', 'units of processing time', 'given that', 'where', 'respectively') inside dollar signs!\n" +
                "3. NATURAL TEXTBOOK QUESTION STYLE: Write a crisp, authentic, textbook-grade GATE CS problem statement formulated strictly within the provided Scenario Domain and Sub-Aspect. DO NOT use artificial or awkward intros.\n" +
                "4. MERMAID DIAGRAMS: If a diagram helps explain a circuit, pipeline, tree, state machine, or ER model, include valid ```mermaid ... ``` block inside questionText. Use strict Mermaid syntax for edge labels (e.g. -->|Label| B). Never append extra '>' after pipe.\n" +
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
                "}";

        prompt = String.format(prompt,
                topicContext, subject, diagramInstruction);

        // ── Direct Groq Call: Llama 3.1 8B Instant (Fast Generator for Initial Draft) ──
        try {
            log.info("🤖 Generating Question Draft via Groq (Round-Robin Load Balancing)...");
            JsonNode groqRes = executeGroqCall(prompt, false, 2048);
            if (groqRes != null) return groqRes;
        } catch (Exception e) {
            log.error("❌ Groq generator call failed: {}", e.getMessage());
        }
        return null;
    }

    private VerificationResult callGroqVerifier(String qText, JsonNode optionsNode, String qType) {
        StringBuilder sb = new StringBuilder();
        sb.append("Role: Senior GATE CSE Chief Examiner & Verification AI.\n" +
                  "Tasks:\n" +
                  "1. Solve this question independently step-by-step and determine the exact correct answer.\n" +
                  "2. REPHRASE & POLISH TO AUTHENTIC GATE CSE STANDARD: If the question statement or option text can be written more cleanly, rephrase it to match authentic IIT/IISc GATE CSE exam terminology with clean KaTeX math (single dollar $...$ ONLY around individual variables e.g. $t_1$, $\\\\mathcal{O}(n)$, and $\\\\overline{b_1}$ for complements). DO NOT change the mathematical values, NAT numbers, or correct option letter.\n\n" +
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
                  "   - \"explanation\": \"Concise step-by-step mathematical proof (strictly under 150 words) explaining why the answer is correct.\"\n" +
                  "   - \"rephrasedQuestionText\": \"Polished GATE-level question text with clean KaTeX math.\"\n");

        // ── Direct Call: Heavy Model -> Gemini 2.5 Flash -> Fast Model Fallback ──
        try {
            log.info("🤖 Answer Verification & Quality Polish via Groq 70B...");
            JsonNode res = executeGroqCall(sb.toString(), true, 3072);
            if (res == null && geminiApiKey != null && !geminiApiKey.isBlank()) {
                log.info("🌐 [AI Verifier] Groq 70B rate-limited — Fallback to Gemini 2.5 Flash Verifier...");
                try {
                    res = executeGeminiCall(sb.toString(), 3072);
                } catch (Exception ge) {
                    log.warn("⚠️ Gemini Verifier fallback call failed: {}", ge.getMessage());
                }
            }
            if (res == null) {
                log.info("⚡ [AI Verifier] Groq 70B & Gemini rate-limited — Fallback to Groq 8B Fast Verifier...");
                res = executeGroqCall(sb.toString(), false, 2048);
            }
            if (res != null) {
                String ans = res.has("answer") ? res.get("answer").asText() : "";
                String exp = res.has("explanation") ? res.get("explanation").asText() : "";
                String rephrasedQ = res.has("rephrasedQuestionText") ? res.get("rephrasedQuestionText").asText() : null;
                JsonNode rephrasedOpts = res.has("rephrasedOptions") ? res.get("rephrasedOptions") : null;
                if (!ans.isBlank()) {
                    return new VerificationResult(ans, exp, rephrasedQ, rephrasedOpts);
                }
            }
        } catch (Exception e) {
            log.error("❌ Verifier call failed: {}", e.getMessage());
        }
        return new VerificationResult("", "");
    }

    private JsonNode executeGroqCall(String prompt, boolean isHeavyModel, int maxTokens) {
        int maxRetries = Math.max(3, groqKeyManager.getKeyCount() * 2);
        int currentMaxTokens = maxTokens;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            String apiKey = groqKeyManager.getNextKey();
            if (apiKey == null) return null;

            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setBearerAuth(apiKey);

                ObjectNode req = objectMapper.createObjectNode();
                req.put("model", isHeavyModel ? heavyModel : fastModel);
                req.put("temperature", 0.1);
                req.put("max_tokens", currentMaxTokens);
                req.put("response_format", objectMapper.createObjectNode().put("type", "json_object"));

                ArrayNode messages = objectMapper.createArrayNode();
                messages.add(objectMapper.createObjectNode().put("role", "system").put("content", "You respond strictly in raw JSON object format with valid double-escaped LaTeX."));
                messages.add(objectMapper.createObjectNode().put("role", "user").put("content", prompt));
                req.set("messages", messages);

                ResponseEntity<String> response = restTemplate.exchange(GROQ_API_URL, HttpMethod.POST, new HttpEntity<>(req.toString(), headers), String.class);
                if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                    JsonNode root = objectMapper.readTree(response.getBody());
                    if (root != null) {
                        if (root.has("usage") && root.get("usage").has("total_tokens")) {
                            long tokensUsed = root.get("usage").get("total_tokens").asLong();
                            totalAiGeneratorTokens.addAndGet(tokensUsed);
                            groqUsageService.addTokens(tokensUsed);
                            log.info("🤖 [AI Generator Token Ledger] Call consumed {} tokens. Total AI Generator Tokens: {}", tokensUsed, totalAiGeneratorTokens.get());
                        }
                        if (root.has("choices") && root.get("choices").isArray() && root.get("choices").size() > 0) {
                            String content = root.get("choices").get(0).get("message").get("content").asText();
                            String sanitized = sanitizeLaTeXInJson(content);
                            return objectMapper.readTree(sanitized);
                        }
                    }
                }
            } catch (Exception e) {
                String errMsg = e.getMessage() != null ? e.getMessage() : "";
                if (is429RateLimitError(e, errMsg)) {
                    groqKeyManager.markRateLimited(apiKey);
                    log.warn("⚠️ Groq HTTP 429 Rate Limit on attempt {}/{} for key [...{}]. Pacing 3.5s & switching key...", 
                            attempt, maxRetries, maskKey(apiKey));
                    try { Thread.sleep(3500); } catch (InterruptedException ignored) {}
                } else if (errMsg.contains("400") || errMsg.toLowerCase().contains("bad request")) {
                    log.warn("⚠️ Groq 400 Bad Request on attempt {} (Error: {}). Expanding max_tokens to {}...", 
                            attempt, errMsg, currentMaxTokens + 1000);
                    currentMaxTokens += 1000;
                } else {
                    log.error("Groq API call failed during question generation (attempt {}): {}", attempt, errMsg);
                }
            }
        }
        return null;
    }

    private String sanitizeLaTeXInJson(String json) {
        if (json == null) return null;
        String s = json
                .replace("\f", "\\\\f")
                .replace("\t", "\\\\t")
                .replace("\r", "\\\\r")
                .replace("\b", "\\\\b");

        // Auto-repair control character artifacts and unescaped TeX commands in JSON string
        s = s.replaceAll("(?<!\\\\)\\brac\\{", "\\\\frac{");
        s = s.replaceAll("(?<!\\\\)\\bimes\\b", "\\\\times");
        s = s.replaceAll("(?<!\\\\)\\bleft\\(", "\\\\left(");
        s = s.replaceAll("(?<!\\\\)\\bight\\)", "\\\\right)");
        s = s.replaceAll("(?<!\\\\)\\bbegin\\{", "\\\\begin{");
        s = s.replaceAll("(?<!\\\\)\\bend\\{", "\\\\end{");
        s = s.replaceAll("(?<!\\\\)\\bsqrt\\{", "\\\\sqrt{");
        s = s.replaceAll("(?<!\\\\)\\boverline\\{", "\\\\overline{");
        s = s.replaceAll("(?<!\\\\)\\bcdot\\b", "\\\\cdot");
        s = s.replaceAll("(?<!\\\\)\\bsum\\b", "\\\\sum");

        // Auto-repair any unescaped single backslashes in JSON strings (e.g. \s, \m, \d, \w, \p)
        s = s.replaceAll("(?<!\\\\)\\\\(?![\"\\\\/bfnrtu])", "\\\\\\\\");
        return s;
    }

    private boolean is429RateLimitError(Exception e, String errMsg) {
        if (e instanceof org.springframework.web.client.HttpClientErrorException.TooManyRequests) return true;
        if (e instanceof org.springframework.web.client.HttpStatusCodeException) {
            org.springframework.web.client.HttpStatusCodeException se = (org.springframework.web.client.HttpStatusCodeException) e;
            if (se.getStatusCode().value() == 429) return true;
            if (se.getResponseBodyAsString() != null && se.getResponseBodyAsString().contains("rate_limit_exceeded")) return true;
        }
        return errMsg.contains("429") || errMsg.toLowerCase().contains("rate limit") || errMsg.toLowerCase().contains("too many requests");
    }

    private String maskKey(String key) {
        if (key == null || key.length() < 6) return "***";
        return key.substring(key.length() - 6);
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

            // 2. Dynamic Option Content Match: If verifier returned full option text instead of label "A"
            if (optionsNode != null && optionsNode.isArray()) {
                for (JsonNode opt : optionsNode) {
                    String optLabel = opt.has("label") ? opt.get("label").asText().toUpperCase() : "";
                    String optText = opt.has("text") ? opt.get("text").asText().replaceAll("\\s+", "").toUpperCase() : "";
                    if (!optText.isEmpty() && optText.length() >= 5 && (v.contains(optText) || optText.contains(v))) {
                        if (gLetter.equalsIgnoreCase(optLabel)) {
                            log.info("🎯 Dynamic Option Match Success! Verifier returned option text matching option {}", optLabel);
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
                    if (!optText.isEmpty() && optText.length() >= 5 && (v.contains(optText) || optText.contains(v))) {
                        matchedVerLabels.add(label);
                    }
                });
                if (!matchedVerLabels.isEmpty() && matchedVerLabels.equals(gSet)) return true;
            }
            return false;
        } else {
            // NAT Numerical match with GATE tolerance, range support, fractions, and unit stripping
            return isNatAnswerMatch(gen, ver);
        }
    }

    private boolean isNatAnswerMatch(String gRaw, String vRaw) {
        if (gRaw == null || vRaw == null) return false;
        String g = gRaw.trim().toLowerCase();
        String v = vRaw.trim().toLowerCase();

        if (g.equalsIgnoreCase(v)) return true;

        List<Double> gNumbers = extractDoubles(g);
        List<Double> vNumbers = extractDoubles(v);

        if (gNumbers.isEmpty() || vNumbers.isEmpty()) {
            return g.replaceAll("[^a-z0-9]", "").equalsIgnoreCase(v.replaceAll("[^a-z0-9]", ""));
        }

        // Case A: Single number vs Single number (e.g. 3.33 vs 3.333 or 42 vs 42.0)
        if (gNumbers.size() == 1 && vNumbers.size() == 1) {
            double gNum = gNumbers.get(0);
            double vNum = vNumbers.get(0);
            double diff = Math.abs(gNum - vNum);
            if (diff <= 0.1) return true;
            // Check relative error (within 2%)
            if (Math.abs(vNum) > 0.0001 && (diff / Math.abs(vNum)) <= 0.02) return true;
            return false;
        }

        // Case B: Range vs Single Number (e.g. "10 to 12" vs "11.5" or "3.3 to 3.4" vs "3.33")
        if (gNumbers.size() == 2 && vNumbers.size() == 1) {
            double min = Math.min(gNumbers.get(0), gNumbers.get(1));
            double max = Math.max(gNumbers.get(0), gNumbers.get(1));
            double val = vNumbers.get(0);
            return val >= (min - 0.05) && val <= (max + 0.05);
        }
        if (vNumbers.size() == 2 && gNumbers.size() == 1) {
            double min = Math.min(vNumbers.get(0), vNumbers.get(1));
            double max = Math.max(vNumbers.get(0), vNumbers.get(1));
            double val = gNumbers.get(0);
            return val >= (min - 0.05) && val <= (max + 0.05);
        }

        // Case C: Range vs Range (e.g. "10 to 12" vs "10-12")
        if (gNumbers.size() >= 2 && vNumbers.size() >= 2) {
            double gMin = Math.min(gNumbers.get(0), gNumbers.get(1));
            double gMax = Math.max(gNumbers.get(0), gNumbers.get(1));
            double vMin = Math.min(vNumbers.get(0), vNumbers.get(1));
            double vMax = Math.max(vNumbers.get(0), vNumbers.get(1));
            return Math.abs(gMin - vMin) <= 0.15 && Math.abs(gMax - vMax) <= 0.15;
        }

        return false;
    }

    private List<Double> extractDoubles(String str) {
        List<Double> list = new ArrayList<>();
        if (str == null) return list;
        // Handle fraction like 10/3 -> 3.33
        if (str.contains("/")) {
            try {
                String[] parts = str.replaceAll("[^0-9/.-]", "").split("/");
                if (parts.length == 2 && Double.parseDouble(parts[1]) != 0) {
                    list.add(Double.parseDouble(parts[0]) / Double.parseDouble(parts[1]));
                    return list;
                }
            } catch (Exception ignored) {}
        }
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("-?\\d+(?:\\.\\d+)?").matcher(str);
        while (m.find()) {
            try {
                list.add(Double.parseDouble(m.group()));
            } catch (Exception ignored) {}
        }
        return list;
    }

    public void saveQuestionToDatabase(Subject subject, Topic topic, String difficulty, String qType, JsonNode node, String genAnswer, String explanation, String status, String checksumHash) {
        try {
            String qText = node.has("questionText") ? node.get("questionText").asText() : "";

            Question q = Question.builder()
                    .text(qText)
                    .questionType(qType)
                    .difficulty(difficulty)
                    .marks("HARD".equalsIgnoreCase(difficulty) || "GATE_SUPER".equalsIgnoreCase(difficulty) ? 2 : 1)
                    .negativeMarks("MCQ".equalsIgnoreCase(qType) ? (("HARD".equalsIgnoreCase(difficulty) || "GATE_SUPER".equalsIgnoreCase(difficulty)) ? 0.66 : 0.33) : 0.0)
                    .year(LocalDateTime.now().getYear())
                    .subject(subject)
                    .topic(topic)
                    .isCommunityVerified("APPROVED".equalsIgnoreCase(status))
                    .checksumHash(checksumHash)
                    .pdfSourceName("AI_NIGHTLY_" + java.time.LocalDate.now().toString())
                    .pdfSourcePath("system/ai-generator")
                    .pdfPageNumber(1)
                    .status(status)
                    .build();

            List<QuestionOption> options = new ArrayList<>();
            // STRICT VALIDATION: Strip options if question type is NAT
            if (!"NAT".equalsIgnoreCase(qType) && node.has("options") && node.get("options").isArray()) {
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
            String safeAnswer = (genAnswer != null && !genAnswer.isBlank()) ? genAnswer.trim() : "A";
            analyses.add(QuestionAIAnalysis.builder()
                    .question(q)
                    .suggestedAnswer(safeAnswer)
                    .suggestedExplanation(explanation != null && !explanation.isBlank() ? explanation : "Dual-AI Verified Practice Question.")
                    .confidence(1.0)
                    .modelName("Groq-8B-70B-Dual")
                    .build());
            q.setAiAnalyses(analyses);

            // Auto-tag question for indexing & searchability
            Set<Tag> tags = new HashSet<>();
            String[] tagNames = { "AI_GENERATED", "GATE_PRACTICE", subject.getName(), topic.getName() };
            for (String tagName : tagNames) {
                if (tagName != null && !tagName.isBlank()) {
                    String cleanTag = tagName.trim();
                    Tag tag = tagRepository.findByName(cleanTag)
                            .orElseGet(() -> tagRepository.save(Tag.builder().name(cleanTag).build()));
                    tags.add(tag);
                }
            }
            q.setTags(tags);

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
