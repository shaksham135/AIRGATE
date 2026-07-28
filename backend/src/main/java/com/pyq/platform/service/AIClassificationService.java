package com.pyq.platform.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

@Service
@Slf4j
public class AIClassificationService {

    @Value("${gemini.api.key:}")
    private String geminiApiKey;

    @Value("${groq.api.key:}")
    private String groqApiKey1;

    @Value("${groq.api.key.2:}")
    private String groqApiKey2;

    @Value("${groq.api.key.3:}")
    private String groqApiKey3;

    private List<String> apiKeys = new ArrayList<>();
    private int currentKeyIndex = 0;

    @Value("${groq.model.fast:gemma-2-9b-it}")
    private String fastModel;

    private static final String GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
    private final ObjectMapper objectMapper = new ObjectMapper();
    private RestTemplate restTemplate;
    private final GroqUsageService groqUsageService;

    public AIClassificationService(GroqUsageService groqUsageService) {
        this.groqUsageService = groqUsageService;
    }

    @PostConstruct
    public void init() {
        if (groqApiKey1 != null && !groqApiKey1.isBlank() && !groqApiKey1.equals("your-groq-api-key")) {
            apiKeys.add(groqApiKey1);
        } else if (System.getenv("GROQ_API_KEY") != null) {
            apiKeys.add(System.getenv("GROQ_API_KEY"));
        }
        
        if (groqApiKey2 != null && !groqApiKey2.isBlank()) {
            apiKeys.add(groqApiKey2);
        } else if (System.getenv("GROQ_API_KEY_2") != null) {
            apiKeys.add(System.getenv("GROQ_API_KEY_2"));
        }

        if (groqApiKey3 != null && !groqApiKey3.isBlank()) {
            apiKeys.add(groqApiKey3);
        } else if (System.getenv("GROQ_API_KEY_3") != null) {
            apiKeys.add(System.getenv("GROQ_API_KEY_3"));
        }

        if (apiKeys.isEmpty()) {
            log.warn("No Groq API keys found. AI classification will fallback to mock parsing.");
        }

        org.springframework.http.client.SimpleClientHttpRequestFactory factory = new org.springframework.http.client.SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000); // 10s
        factory.setReadTimeout(30000); // 30s
        this.restTemplate = new RestTemplate(factory);
    }

    public static class AIAnalysisResult {
        public String questionText;
        public String questionType; // MCQ, MSQ, NAT
        public int marks;
        public double negativeMarks;
        public String difficulty; // EASY, MEDIUM, HARD
        public String subjectName;
        public String topicName;
        public String parentTopicName;
        public String suggestedAnswer;
        public String suggestedExplanation;
        public String mentorInsights;
        public double confidenceScore;
        public double questionConfidence;
        public double optionsConfidence;
        public double answerConfidence;
        public String rawAiJson;
        public String[] tags;
        public List<String> options;
        public boolean isFallback;
    }


    private synchronized String getNextApiKey() {
        if (apiKeys.isEmpty()) return null;
        String key = apiKeys.get(currentKeyIndex);
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.size();
        return key;
    }

    private String buildClassifySystemPrompt() {
        return "You are a professional compiler for GATE CSE exam papers.\n"
                + "Parse the raw input question block into structured JSON details.\n"
                + "IMPORTANT: Strip any appended answer key or text like 'Answer: A' or 'Ans: B' or 'Correct Option: C' from the end of the questionText.\n"
                + "Respond ONLY with a JSON object containing these keys:\n"
                + "- \"questionText\": Cleaned question body. Keep tables, code blocks (wrap in triple backticks), and math equations. Strip choice labels (e.g. A, B, C, D), solution texts, and duplicate diagrams labels. NEVER include the answer/solution text inside the questionText.\n"
                + "- \"questionType\": either \"MCQ\", \"MSQ\", or \"NAT\"\n"
                + "- \"marks\": either 1 or 2\n"
                + "- \"negativeMarks\": MCQ 1-mark is -0.33, MCQ 2-mark is -0.66, MSQ/NAT is 0.0\n"
                + "- \"subjectName\": Match standard GATE CSE subjects: \"General Aptitude\", \"Engineering Mathematics\", \"Digital Logic\", \"Computer Organization and Architecture\", \"Programming and Data Structures\", \"Algorithms\", \"Theory of Computation\", \"Compiler Design\", \"Operating Systems\", \"Databases\", \"Computer Networks\".\n"
                + "- \"parentTopicName\": General topic category\n"
                + "- \"topicName\": Specific subtopic name\n"
                + "- \"suggestedAnswer\": Correct option letter (A, B, C, D) or exact NAT numeric value/range (e.g. \"10\", \"4.5\", \"10-12\"). No words like 'Option' or 'Ans' for NAT. Ensure this is 100% correct.\n"
                + "- \"options\": array of clean options (without letters). The text of each option MUST exactly match the raw text of the option in the input question (keep mathematical signs, subscripts, superscripts, etc. exactly same as in original text). Empty array if NAT.\n"
                + "- \"tags\": array of 2-3 short tag strings.\n"
                + "- \"questionConfidence\": 0.0 to 1.0 confidence score for the question text.\n"
                + "- \"optionsConfidence\": 0.0 to 1.0 confidence score for the options text.\n"
                + "- \"answerConfidence\": 0.0 to 1.0 confidence score for the correct answer.\n";
    }

    public AIAnalysisResult classifyQuestion(String rawText, String filename) {
        String systemPrompt = buildClassifySystemPrompt();
        String userContent = "Context PDF Filename: " + filename + "\nRaw text to parse: " + rawText;

        // ── PRIMARY: Google Gemini 1.5 Flash ──────────────────────────────────
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                log.info("🌟 [PDF Classify] Using Google Gemini as primary...");
                String jsonText = callGeminiClassify(systemPrompt, userContent);
                if (jsonText != null && !jsonText.isBlank()) {
                    return parseClassifyJson(jsonText, rawText);
                }
            } catch (Exception e) {
                log.warn("⚠️ [PDF Classify] Gemini failed ({}), falling back to Groq...", e.getMessage());
            }
        }

        // ── FALLBACK: Groq ────────────────────────────────────────────────────
        String currentApiKey = getNextApiKey();
        if (currentApiKey == null) {
            log.warn("No Groq API Key configured. Falling back to mock parsing.");
            return generateMockAnalysis(rawText);
        }

        int maxRetries = 3;
        int retryDelayMs = 2500;

        for (int attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.set("Authorization", "Bearer " + currentApiKey);

                ObjectNode rootNode = objectMapper.createObjectNode();
                rootNode.put("model", fastModel);
                rootNode.put("temperature", 0.1);
                rootNode.put("max_tokens", 1500);

                ObjectNode responseFormatNode = rootNode.putObject("response_format");
                responseFormatNode.put("type", "json_object");

                ArrayNode messages = rootNode.putArray("messages");
                ObjectNode systemMsg = messages.addObject();
                systemMsg.put("role", "system");
                systemMsg.put("content", systemPrompt);

                ObjectNode userMsg = messages.addObject();
                userMsg.put("role", "user");
                userMsg.put("content", userContent);

                HttpEntity<String> entity = new HttpEntity<>(rootNode.toString(), headers);
                ResponseEntity<String> response = restTemplate.exchange(GROQ_API_URL, HttpMethod.POST, entity,
                        String.class);

                JsonNode jsonResponse = objectMapper.readTree(response.getBody());
                long tokenUsage = jsonResponse.path("usage").path("total_tokens").asLong(0);
                if (tokenUsage > 0) {
                    groqUsageService.addTokens(tokenUsage);
                } else if (response.getHeaders().containsKey("x-total-tokens")) {
                    try {
                        long hTokens = Long.parseLong(response.getHeaders().getFirst("x-total-tokens"));
                        groqUsageService.addTokens(hTokens);
                    } catch (NumberFormatException e) {
                        // ignore
                    }
                }
                String jsonText = jsonResponse.path("choices").get(0).path("message").path("content").asText();
                return parseClassifyJson(jsonText, rawText);

            } catch (org.springframework.web.client.HttpClientErrorException.TooManyRequests e) {
                log.warn("Groq rate limit hit (429) on attempt {}/{} for question. Retrying in {}ms...", 
                        attempt, maxRetries, retryDelayMs);
                if (apiKeys.size() > 1) {
                    currentApiKey = getNextApiKey();
                    log.info("Switched to next Groq API key: {}", currentApiKey.substring(0, Math.min(8, currentApiKey.length())) + "...");
                    continue;
                }
                try { Thread.sleep(retryDelayMs); } catch (InterruptedException ie) { Thread.currentThread().interrupt(); }
                retryDelayMs *= 1.5;
            } catch (Exception e) {
                if (e.getMessage() != null && e.getMessage().contains("429") && apiKeys.size() > 1) {
                    currentApiKey = getNextApiKey();
                    log.info("Switched to next Groq API key due to rate limit: {}", currentApiKey.substring(0, Math.min(8, currentApiKey.length())) + "...");
                    continue;
                }
                log.error("Groq AI query failed on attempt {}/{}: {}. Falling back to mock parsing.", 
                        attempt, maxRetries, e.getMessage());
                return generateMockAnalysis(rawText);
            }
        }

        log.error("Failed to call Groq AI after {} attempts due to rate limiting. Falling back to mock parsing.", maxRetries);
        return generateMockAnalysis(rawText);
    }

    private String callGeminiClassify(String systemPrompt, String userContent) throws Exception {
        String url = GEMINI_API_URL + "?key=" + geminiApiKey;
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);

        ObjectNode requestBody = objectMapper.createObjectNode();

        // System instruction
        ObjectNode sysInstruction = objectMapper.createObjectNode();
        ArrayNode sysParts = objectMapper.createArrayNode();
        sysParts.add(objectMapper.createObjectNode().put("text", systemPrompt));
        sysInstruction.set("parts", sysParts);
        requestBody.set("systemInstruction", sysInstruction);

        // User content
        ArrayNode contents = objectMapper.createArrayNode();
        ObjectNode contentObj = objectMapper.createObjectNode();
        ArrayNode parts = objectMapper.createArrayNode();
        parts.add(objectMapper.createObjectNode().put("text", userContent));
        contentObj.set("parts", parts);
        contentObj.put("role", "user");
        contents.add(contentObj);
        requestBody.set("contents", contents);

        // JSON mode config
        ObjectNode genConfig = objectMapper.createObjectNode();
        genConfig.put("temperature", 0.1);
        genConfig.put("maxOutputTokens", 1500);
        genConfig.put("responseMimeType", "application/json");
        requestBody.set("generationConfig", genConfig);

        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST,
                new HttpEntity<>(requestBody.toString(), headers), String.class);

        if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
            JsonNode root = objectMapper.readTree(response.getBody());
            if (root.has("usageMetadata")) {
                groqUsageService.addTokens(root.get("usageMetadata").path("totalTokenCount").asLong(0));
            }
            JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && candidates.size() > 0) {
                String text = candidates.get(0).path("content").path("parts").get(0).path("text").asText();
                if (text != null && !text.isBlank()) {
                    return text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();
                }
            }
        }
        return null;
    }

    private AIAnalysisResult parseClassifyJson(String jsonText, String rawText) throws Exception {
        String cleanJson = jsonText != null ? jsonText.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim() : "";
        JsonNode parsedResult;
        try {
            parsedResult = objectMapper.readTree(cleanJson);
        } catch (Exception e) {
            log.warn("⚠️ Failed to parse AI JSON response, falling back to local block extraction: {}", e.getMessage());
            return generateMockAnalysis(rawText);
        }

        AIAnalysisResult res = new AIAnalysisResult();
        res.questionType = parsedResult.path("questionType").asText("MCQ").toUpperCase();
        res.questionText = cleanTrailingAnswers(stripQuestionNumbering(parsedResult.path("questionText").asText(rawText)));
        res.marks = parsedResult.path("marks").asInt(1);
        res.negativeMarks = parsedResult.path("negativeMarks").asDouble(-0.33);
        res.difficulty = parsedResult.path("difficulty").asText("MEDIUM").toUpperCase();
        res.subjectName = parsedResult.path("subjectName").asText("Programming and Data Structures");
        res.parentTopicName = parsedResult.path("parentTopicName").asText("Trees");
        res.topicName = parsedResult.path("topicName").asText("Binary Search Trees");
        res.suggestedAnswer = cleanAnswer(parsedResult.path("suggestedAnswer").asText("A"));

        res.suggestedExplanation = "### Detailed Solution\n"
                + "The correct answer is **" + res.suggestedAnswer + "**.\n\n"
                + "### Core Concept Tested\n"
                + "This question evaluates concepts related to **" + res.topicName + "** under the subject **" + res.subjectName + "**.\n\n"
                + "### GATE Relevance & Frequency\n"
                + "Topics in **" + res.topicName + "** are frequently tested in GATE CSE. Ensure a strong grasp of foundational definitions.";
        res.mentorInsights = "### Diagnostic Profile (Correct Attempt)\n"
                + "- **Strengths Indicated**: Strong analytical understanding of " + res.topicName + ".\n"
                + "- **Revision Checklist**: Review advanced boundary conditions.\n\n"
                + "### Diagnostic Profile (Incorrect Attempt)\n"
                + "- **Probable Knowledge Gaps**: Conceptual confusion in " + res.parentTopicName + ".\n"
                + "- **Revision Checklist**: Re-read textbooks on " + res.topicName + ".";
        res.confidenceScore = parsedResult.path("confidenceScore").asDouble(0.95);
        res.questionConfidence = parsedResult.path("questionConfidence").asDouble(res.confidenceScore);
        res.optionsConfidence = parsedResult.path("optionsConfidence").asDouble(res.confidenceScore);
        res.answerConfidence = parsedResult.path("answerConfidence").asDouble(res.confidenceScore);
        res.rawAiJson = jsonText;
        res.isFallback = false;

        JsonNode tagsNode = parsedResult.path("tags");
        List<String> tagsList = new ArrayList<>();
        if (tagsNode.isArray()) { for (JsonNode t : tagsNode) tagsList.add(t.asText()); }
        res.tags = tagsList.toArray(new String[0]);

        JsonNode optionsNode = parsedResult.path("options");
        List<String> optionsList = new ArrayList<>();
        if (optionsNode.isArray()) { for (JsonNode o : optionsNode) optionsList.add(o.asText()); }
        res.options = optionsList;
        return res;
    }

    public AIAnalysisResult generateMockAnalysis(String rawText) {
        AIAnalysisResult res = new AIAnalysisResult();
        res.confidenceScore = 0.50; // Mock confidence indicator
        res.suggestedAnswer = "A";
        res.difficulty = "MEDIUM";
        res.isFallback = true;

        res.suggestedExplanation = "Local fallback parser was used because Groq key is unconfigured or rate limited.";
        res.mentorInsights = "### Diagnostic Profile (Correct Attempt)\n- **Strengths Indicated**: Analytical reasoning and subject familiarization.\n- **Mastered Concepts**: Basic terminologies of this subject.\n- **Preparation Level**: Foundational\n\n### Diagnostic Profile (Incorrect Attempt)\n- **Probable Knowledge Gaps**: Syntactic structure or conceptual familiarity.\n- **Revision Checklist**: Subject fundamental definitions.\n- **Misconceptions & Traps**: Confusing memory recall with active execution.\n\n### Downstream Impact & Preparation Strategy\n- **Next Steps (Easier Topics)**: Basic algorithms.\n- **Risk Warning (Difficult Topics)**: Complex applications of this subject.";
        res.tags = new String[] { "gate", "cse" };

        String lower = rawText.toLowerCase();

        // 1. Guess type and marks
        if (lower.contains("msq") || lower.contains("multiple select")) {
            res.questionType = "MSQ";
            res.marks = 2;
            res.negativeMarks = 0.0;
        } else if (lower.contains("numerical") || lower.contains("nat")
                || (!lower.contains("(a)") && !lower.contains("(b)") && !lower.contains("(c)") && !lower.contains("(d)")
                        && !lower.contains("a)") && !lower.contains("b)"))) {
            res.questionType = "NAT";
            res.marks = 2;
            res.negativeMarks = 0.0;
            res.suggestedAnswer = "10";
        } else {
            res.questionType = "MCQ";
            res.marks = lower.contains("2 mark") ? 2 : 1;
            res.negativeMarks = res.marks == 1 ? -0.33 : -0.66;
        }

        // 2. Set question text and options based on type
        if ("NAT".equals(res.questionType)) {
            res.questionText = cleanTrailingAnswers(stripQuestionNumbering(rawText));
            res.options = new ArrayList<>();
        } else {
            res.options = extractOptionsFromBlockText(rawText);
            res.questionText = cleanTrailingAnswers(stripQuestionNumbering(cleanQuestionTextLocally(rawText)));
        }


        // 3. Guess Subject and Topic tree based on keywords for fallback
        if (lower.contains("eigenvalue") || lower.contains("eigenvector") || lower.contains("matrix") || lower.contains("determinant")
                || lower.contains("linear algebra") || lower.contains("probability") || lower.contains("poisson") 
                || lower.contains("bayes") || lower.contains("graph theory") || lower.contains("permutation")) {
            res.subjectName = "Engineering Mathematics";
            res.parentTopicName = "Linear Algebra";
            res.topicName = "Matrices";
            res.tags = new String[] { "math", "matrices" };
        } else if (lower.contains("aptitude") || lower.contains("verbal") || lower.contains("english") || lower.contains("reasoning")
                || lower.contains("passage") || lower.contains("grammar") || lower.contains("interest") || lower.contains("speed")) {
            res.subjectName = "General Aptitude";
            res.parentTopicName = "Quantitative Aptitude";
            res.topicName = "Numerical Reasoning";
            res.tags = new String[] { "aptitude", "general" };
        } else if (lower.contains("logic gate") || lower.contains("multiplexer") || lower.contains("boolean") || lower.contains("k-map")
                || lower.contains("flip flop") || lower.contains("counter") || lower.contains("karnaugh")) {
            res.subjectName = "Digital Logic";
            res.parentTopicName = "Combinational Circuits";
            res.topicName = "Logic Design";
            res.tags = new String[] { "digital", "logic" };
        } else if (lower.contains("cache") || lower.contains("pipeline") || lower.contains("coa") || lower.contains("instruction cycle")
                || lower.contains("addressing mode") || lower.contains("memory organization") || lower.contains("cpu architecture")) {
            res.subjectName = "Computer Organization and Architecture";
            res.parentTopicName = "Memory Hierarchy";
            res.topicName = "Cache Memory";
            res.tags = new String[] { "coa", "cache" };
        } else if (lower.contains("binary tree") || lower.contains("bst") || lower.contains("height") || lower.contains("postorder")
                || lower.contains("stack") || lower.contains("queue") || lower.contains("linked list") || lower.contains("pointer")) {
            res.subjectName = "Programming and Data Structures";
            res.parentTopicName = "Data Structures";
            res.topicName = "Trees";
            res.tags = new String[] { "tree", "data_structures" };
        } else if (lower.contains("sorting") || lower.contains("quick sort") || lower.contains("merge sort") || lower.contains("binary search")
                || lower.contains("greedy") || lower.contains("dynamic programming") || lower.contains("complexity") || lower.contains("np-complete")) {
            res.subjectName = "Algorithms";
            res.parentTopicName = "Sorting and Searching";
            res.topicName = "Analysis of Algorithms";
            res.tags = new String[] { "algorithms", "complexity" };
        } else if (lower.contains("automata") || lower.contains("cfg") || lower.contains("turing machine") || lower.contains("regular language")
                || lower.contains("pda") || lower.contains("context free") || lower.contains("undecidability")) {
            res.subjectName = "Theory of Computation";
            res.parentTopicName = "Formal Languages";
            res.topicName = "Finite Automata";
            res.tags = new String[] { "toc", "automata" };
        } else if (lower.contains("parser") || lower.contains("compiler") || lower.contains("syntax directed") || lower.contains("code generation")
                || lower.contains("intermediate code") || lower.contains("lexer") || lower.contains("parsing table")) {
            res.subjectName = "Compiler Design";
            res.parentTopicName = "Syntax Analysis";
            res.topicName = "Parsers";
            res.tags = new String[] { "compiler", "parsing" };
        } else if (lower.contains("operating system") || lower.contains("os") || lower.contains("process") || lower.contains("thread")
                || lower.contains("semaphore") || lower.contains("deadlock") || lower.contains("scheduling") || lower.contains("virtual memory")
                || lower.contains("paging") || lower.contains("page fault") || lower.contains("mutex")) {
            res.subjectName = "Operating Systems";
            res.parentTopicName = "Process Management";
            res.topicName = "CPU Scheduling";
            res.tags = new String[] { "os", "semaphore" };
        } else if (lower.contains("database") || lower.contains("dbms") || lower.contains("sql") || lower.contains("normalization")
                || lower.contains("transaction") || lower.contains("concurrency") || lower.contains("functional dependency") || lower.contains("key")) {
            res.subjectName = "Databases";
            res.parentTopicName = "Relational Model";
            res.topicName = "Database Normalization";
            res.tags = new String[] { "dbms", "sql" };
        } else if (lower.contains("network") || lower.contains("ip address") || lower.contains("routing") || lower.contains("subnet")
                || lower.contains("tcp") || lower.contains("udp") || lower.contains("dns") || lower.contains("socket")) {
            res.subjectName = "Computer Networks";
            res.parentTopicName = "IP Addressing";
            res.topicName = "Subnetting";
            res.tags = new String[] { "networks", "subnet" };
        } else {
            res.subjectName = "Programming and Data Structures";
            res.parentTopicName = "General";
            res.topicName = "General Category";
            res.tags = new String[] { "general" };
        }

        return res;
    }

    public static String normalizeSubjectName(String rawName) {
        if (rawName == null || rawName.trim().isEmpty()) {
            return "Programming and Data Structures";
        }
        String clean = rawName.trim().toLowerCase()
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ");
        
        if (clean.contains("aptitude") || clean.contains("verbal") || clean.contains("english") || clean.contains("reasoning")) {
            return "General Aptitude";
        }
        if (clean.contains("mathematics") || clean.contains("discrete") || clean.contains("probability") || clean.contains("logic") || clean.contains("algebra") || clean.contains("calculus") || clean.contains("graph theory")) {
            if (clean.contains("computation") || clean.contains("automata")) {
                return "Theory of Computation";
            }
            return "Engineering Mathematics";
        }
        if (clean.contains("digital") || clean.contains("logic design") || clean.contains("switching")) {
            return "Digital Logic";
        }
        if (clean.contains("organization") || clean.contains("architecture") || clean.contains("coa") || clean.contains("pipelining") || clean.contains("cache")) {
            return "Computer Organization and Architecture";
        }
        if (clean.contains("programming") || clean.contains("data structure") || clean.contains("c programming") || clean.contains("tree") || clean.contains("graph ") || clean.contains("stack") || clean.contains("queue") || clean.contains("linked list")) {
            return "Programming and Data Structures";
        }
        if (clean.contains("algorithm") || clean.contains("sorting") || clean.contains("complexity") || clean.contains("greedy") || clean.contains("dynamic prog")) {
            return "Algorithms";
        }
        if (clean.contains("theory of computation") || clean.contains("automata") || clean.contains("cfg") || clean.contains("pda") || clean.contains("turing") || clean.contains("decidability") || clean.contains("formal language")) {
            return "Theory of Computation";
        }
        if (clean.contains("compiler") || clean.contains("parsing") || clean.contains("syntax") || clean.contains("lexer") || clean.contains("intermediate code")) {
            return "Compiler Design";
        }
        if (clean.contains("operating system") || clean.contains("os") || clean.contains("process") || clean.contains("thread") || clean.contains("semaphore") || clean.contains("deadlock") || clean.contains("scheduling") || clean.contains("paging") || clean.contains("virtual memory")) {
            return "Operating Systems";
        }
        if (clean.contains("database") || clean.contains("dbms") || clean.contains("sql") || clean.contains("normalization") || clean.contains("transaction") || clean.contains("concurrency") || clean.contains("indexing") || clean.contains("relation")) {
            return "Databases";
        }
        if (clean.contains("network") || clean.contains("routing") || clean.contains("ip address") || clean.contains("subnet") || clean.contains("tcp") || clean.contains("udp") || clean.contains("dns") || clean.contains("protocol")) {
            return "Computer Networks";
        }
        
        // Exact names matching fallback
        String[] subjects = {
            "General Aptitude", "Engineering Mathematics", "Digital Logic",
            "Computer Organization and Architecture", "Programming and Data Structures",
            "Algorithms", "Theory of Computation", "Compiler Design",
            "Operating Systems", "Databases", "Computer Networks"
        };
        for (String subject : subjects) {
            if (clean.contains(subject.toLowerCase())) {
                return subject;
            }
        }
        return "Programming and Data Structures";
    }

    public static String cleanTopicName(String name) {
        if (name == null || name.trim().isEmpty()) {
            return "General";
        }
        String[] words = name.trim().split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (word.isEmpty()) continue;
            if (sb.length() > 0) sb.append(" ");
            
            String wordLower = word.toLowerCase();
            if (sb.length() > 0 && (wordLower.equals("and") || wordLower.equals("or") || wordLower.equals("of") || wordLower.equals("to") || wordLower.equals("in") || wordLower.equals("for"))) {
                sb.append(wordLower);
            } else {
                sb.append(Character.toUpperCase(word.charAt(0)));
                if (word.length() > 1) {
                    sb.append(word.substring(1).toLowerCase());
                }
            }
        }
        return sb.toString();
    }

    private List<String> extractOptionsFromBlockText(String rawText) {
        List<String> options = new ArrayList<>();
        // Look for (A) / A) patterns up to Z
        java.util.regex.Pattern optionPattern = java.util.regex.Pattern.compile(
                "(?i)(?:^|\\n|\\r)\\s*(?:\\(?([A-Z])\\)?|([A-Z])\\s*\\))\\s+(.*?)(?=\\n\\s*(?:\\(?[A-Z]\\)?|[A-Z]\\s*\\))|$)");
        java.util.regex.Matcher m = optionPattern.matcher(rawText);

        // Find all matches
        java.util.Map<String, String> optionMap = new java.util.TreeMap<>();
        while (m.find()) {
            String label = m.group(1) != null ? m.group(1) : m.group(2);
            String text = m.group(3);
            if (label != null && text != null) {
                optionMap.put(label.toUpperCase(), text.trim());
            }
        }

        if (!optionMap.isEmpty()) {
            char maxChar = 'A';
            for (String key : optionMap.keySet()) {
                if (key.length() == 1) {
                    char c = key.charAt(0);
                    if (c > maxChar && c <= 'Z') {
                        maxChar = c;
                    }
                }
            }
            char endChar = (maxChar < 'D') ? 'D' : maxChar;
            for (char c = 'A'; c <= endChar; c++) {
                String val = optionMap.get(String.valueOf(c));
                if (val != null) {
                    options.add(val);
                } else {
                    options.add("Option " + c + " placeholder");
                }
            }
        }
        return options;
    }

    private String cleanQuestionTextLocally(String rawText) {
        if (rawText == null) return "";
        java.util.regex.Pattern optionStartPattern = java.util.regex.Pattern.compile("(?i)(?:^|\\n|\\r)\\s*(?:\\(?([A-Z])\\)?|([A-Z])\\s*\\))\\s+");
        java.util.regex.Matcher m = optionStartPattern.matcher(rawText);
        if (m.find()) {
            return rawText.substring(0, m.start()).trim();
        }
        return rawText;
    }

    public static String stripQuestionNumbering(String text) {
        if (text == null) return "";
        // Match Q. 21, Q 21, Q.21, Q21., Question 21, etc. at the start of the string
        return text.replaceFirst("^(?i)\\s*(?:Question\\s*\\.?\\s*\\d+|Q\\s*\\.\\s*\\d+|Q\\s+\\d+|Q\\d+\\s*(?:\\.|:|-))\\s*(?:\\.|:|-)?\\s*", "");
    }

    public static String cleanTrailingAnswers(String text) {
        if (text == null) return "";
        // Patterns to match "Answer: A", "Ans: B", "Correct choice is C", "Answer is (D)" at the end of the text
        String[] patterns = {
            "(?i)\\b(correct\\s+)?(ans(wer)?|option|choice|key)\\s*[:=-]?\\s*([A-D]|\\d+(\\.\\d+)?)(\\s*\\([^)]*\\))?\\s*$",
            "(?i)\\b(correct\\s+)?(ans(wer)?|option|choice|key)\\s+is\\s+([A-D]|\\d+(\\.\\d+)?)(\\s*\\([^)]*\\))?\\s*$",
            "(?i)\\b[a-d]\\s*is\\s*the\\s*correct\\s*(ans(wer)?|option|choice|key)\\s*$"
        };
        String cleaned = text;
        for (String pat : patterns) {
            cleaned = cleaned.replaceAll(pat, "");
        }
        return cleaned.trim();
    }

    public static String cleanAnswer(String answer) {
        if (answer == null) return "";
        // Strip asterisks, quotes, brackets, and words like "option", "ans", "answer"
        String cleaned = answer.replaceAll("[\\*\\'\"]", "").trim();
        cleaned = cleaned.replaceAll("(?i)\\b(option|ans|answer|key)\\b", "").trim();
        cleaned = cleaned.replaceAll("[:\\(\\)]", "").trim();
        return cleaned.toUpperCase();
    }

    // -------------------------
    // Inner class to hold structured response
    // -------------------------
    public static class SolutionResult {
        public final String shortSolution;  // Quick answer + trick
        public final String detailedSolution; // Full step-by-step
        public SolutionResult(String shortSolution, String detailedSolution) {
            this.shortSolution = shortSolution;
            this.detailedSolution = detailedSolution;
        }
    }

    private static final String SECTION_DELIMITER = "---DETAILED---";

    private String convertImageToDataUriOrUrl(String pathOrUrl) {
        if (pathOrUrl == null || pathOrUrl.isEmpty()) {
            return null;
        }
        if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
            return pathOrUrl;
        }
        // It's a local file. Let's find it.
        try {
            java.io.File file = new java.io.File(pathOrUrl);
            if (!file.exists()) {
                // Try prepending upload dir or working dir if needed
                file = new java.io.File("uploads/" + pathOrUrl);
            }
            if (!file.exists()) {
                // Try stripping leading slash
                if (pathOrUrl.startsWith("/")) {
                    file = new java.io.File(pathOrUrl.substring(1));
                }
            }
            if (file.exists() && file.isFile()) {
                byte[] bytes = java.nio.file.Files.readAllBytes(file.toPath());
                String base64 = java.util.Base64.getEncoder().encodeToString(bytes);
                // Guess mime type
                String mimeType = "image/png";
                if (pathOrUrl.toLowerCase().endsWith(".jpg") || pathOrUrl.toLowerCase().endsWith(".jpeg")) {
                    mimeType = "image/jpeg";
                } else if (pathOrUrl.toLowerCase().endsWith(".gif")) {
                    mimeType = "image/gif";
                } else if (pathOrUrl.toLowerCase().endsWith(".webp")) {
                    mimeType = "image/webp";
                }
                return "data:" + mimeType + ";base64," + base64;
            }
        } catch (Exception e) {
            log.error("Failed to convert image to data URI: {}", e.getMessage());
        }
        return null;
    }

    public SolutionResult generateDetailedSolution(String questionText, String correctOption) {
        return generateDetailedSolution(questionText, correctOption, null);
    }

    public SolutionResult generateDetailedSolution(String questionText, String correctOption, List<String> imageUrlsOrPaths) {

        String userPrompt =
                "For this GATE CSE/IT question, write TWO sections EXACTLY as shown below.\n\n"
                + "QUESTION:\n" + questionText + "\n\n"
                + "CORRECT ANSWER: " + correctOption + "\n\n"
                + "=== FORMAT (copy exactly) ===\n\n"
                + "SHORT_SOLUTION\n"
                + "Answer: [state the correct option/value]\n"
                + "[1-3 sentences: direct reasoning OR a GATE shortcut trick if one exists. Be concise.]"
                + "If a well-known trick or formula shortcut applies, mention it clearly. Otherwise just state the key idea.\n\n"
                + SECTION_DELIMITER + "\n\n"
                + "DETAILED_SOLUTION\n"
                + "### Detailed Solution\n"
                + "### Step 1: [description]\n"
                + "[content of step 1]\n"
                + "### Step 2: [description]\n"
                + "[content]\n"
                + "... (all steps needed)\n"
                + "### Final Answer\n"
                + "Therefore the answer is " + correctOption + ".\n\n"
                + "=== RULES ===\n"
                + "- SHORT_SOLUTION must be 1-4 lines only\n"
                + "- DETAILED_SOLUTION must be complete step-by-step. Show all calculations.\n"
                + "- Do NOT use LaTeX. Use plain math notation (e.g. t^2/2, integral of t).\n"
                + "- Do NOT add any other sections or extra text outside this format.";

        String systemInstruction = "You are an expert GATE CSE professor. Follow the format exactly. "
                + "Short section must be brief (1-4 lines). Detailed section must be thorough and never truncated.";

        // ── PRIMARY: Google Gemini 1.5 Flash ────────────────────────────────
        if (geminiApiKey != null && !geminiApiKey.isBlank()) {
            try {
                log.info("🌟 [Solution Generator] Using Google Gemini as primary...");
                String url = GEMINI_API_URL + "?key=" + geminiApiKey;
                HttpHeaders gemHeaders = new HttpHeaders();
                gemHeaders.setContentType(MediaType.APPLICATION_JSON);

                ObjectNode gemBody = objectMapper.createObjectNode();

                ObjectNode sysInstr = objectMapper.createObjectNode();
                ArrayNode sysParts = objectMapper.createArrayNode();
                sysParts.add(objectMapper.createObjectNode().put("text", systemInstruction));
                sysInstr.set("parts", sysParts);
                gemBody.set("systemInstruction", sysInstr);

                ArrayNode contents = objectMapper.createArrayNode();
                ObjectNode contentObj = objectMapper.createObjectNode();
                contentObj.put("role", "user");
                ArrayNode parts = objectMapper.createArrayNode();
                parts.add(objectMapper.createObjectNode().put("text", userPrompt));
                contentObj.set("parts", parts);
                contents.add(contentObj);
                gemBody.set("contents", contents);

                ObjectNode genConfig = objectMapper.createObjectNode();
                genConfig.put("temperature", 0.15);
                genConfig.put("maxOutputTokens", 1600);
                gemBody.set("generationConfig", genConfig);

                ResponseEntity<String> gemResp = restTemplate.exchange(url, HttpMethod.POST,
                        new HttpEntity<>(gemBody.toString(), gemHeaders), String.class);

                if (gemResp.getStatusCode().is2xxSuccessful() && gemResp.getBody() != null) {
                    JsonNode root = objectMapper.readTree(gemResp.getBody());
                    if (root.has("usageMetadata")) {
                        groqUsageService.addTokens(root.get("usageMetadata").path("totalTokenCount").asLong(0));
                    }
                    JsonNode candidates = root.path("candidates");
                    if (candidates.isArray() && candidates.size() > 0) {
                        String content = candidates.get(0).path("content").path("parts").get(0).path("text").asText("").trim();
                        if (!content.isBlank()) {
                            String[] sparts = content.split(SECTION_DELIMITER, 2);
                            String shortPart = sparts[0].trim().replaceAll("(?i)^SHORT_SOLUTION\\s*\\n?", "").trim();
                            String detailedPart = sparts.length > 1 ? sparts[1].trim()
                                    .replaceAll("(?i)^DETAILED_SOLUTION\\s*\\n?", "").trim()
                                    : "### Detailed Solution\nSee short solution above.";
                            return new SolutionResult(shortPart, detailedPart);
                        }
                    }
                }
            } catch (Exception gemEx) {
                log.warn("⚠️ [Solution Generator] Gemini failed ({}), falling back to Groq...", gemEx.getMessage());
            }
        }

        // ── FALLBACK: Groq ────────────────────────────────────────────────
        String currentApiKey = getNextApiKey();
        if (currentApiKey == null) {
            String fallback = "Correct answer: " + correctOption;
            return new SolutionResult(fallback,
                    "### Detailed Solution\nThe correct answer is " + correctOption + ".\n\n*(Groq API not configured)*");
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("Authorization", "Bearer " + currentApiKey);

            ObjectNode rootNode = objectMapper.createObjectNode();
            rootNode.put("temperature", 0.15);
            rootNode.put("max_tokens", 1600);

            ArrayNode messages = rootNode.putArray("messages");
            ObjectNode systemMsg = messages.addObject();
            systemMsg.put("role", "system");
            systemMsg.put("content", systemInstruction);

            ObjectNode userMsg = messages.addObject();
            userMsg.put("role", "user");

            if (imageUrlsOrPaths != null && !imageUrlsOrPaths.isEmpty()) {
                rootNode.put("model", "llama-3.2-11b-vision-preview");
                ArrayNode contentArray = objectMapper.createArrayNode();
                ObjectNode textObj = contentArray.addObject();
                textObj.put("type", "text");
                textObj.put("text", userPrompt + "\n\nNote: The question contains the attached diagram/image(s). Refer to the visual features to build the step-by-step calculations/solution.");
                for (String imgPath : imageUrlsOrPaths) {
                    String dataUri = convertImageToDataUriOrUrl(imgPath);
                    if (dataUri != null) {
                        ObjectNode imgObj = contentArray.addObject();
                        imgObj.put("type", "image_url");
                        ObjectNode imgUrlObj = imgObj.putObject("image_url");
                        imgUrlObj.put("url", dataUri);
                    }
                }
                userMsg.set("content", contentArray);
            } else {
                rootNode.put("model", fastModel);
                userMsg.put("content", userPrompt);
            }

            HttpEntity<String> entity = new HttpEntity<>(rootNode.toString(), headers);
            ResponseEntity<String> response = restTemplate.exchange(GROQ_API_URL, HttpMethod.POST, entity, String.class);

            JsonNode jsonResponse = objectMapper.readTree(response.getBody());
            long tokenUsage = jsonResponse.path("usage").path("total_tokens").asLong(0);
            if (tokenUsage > 0) groqUsageService.addTokens(tokenUsage);

            JsonNode choice = jsonResponse.path("choices").get(0);
            String content = choice.path("message").path("content").asText().trim();
            String finishReason = choice.path("finish_reason").asText("stop");

            String[] sparts = content.split(SECTION_DELIMITER, 2);
            String shortPart = sparts[0].trim().replaceAll("(?i)^SHORT_SOLUTION\\s*\\n?", "").trim();
            String detailedPart = sparts.length > 1 ? sparts[1].trim()
                    .replaceAll("(?i)^DETAILED_SOLUTION\\s*\\n?", "").trim()
                    : "### Detailed Solution\nSee short solution above.";

            if ("length".equals(finishReason)) {
                detailedPart += "\n\n*(Solution may be incomplete due to response length. Correct answer: " + correctOption + ".)*";
            }

            return new SolutionResult(shortPart, detailedPart);

        } catch (Exception e) {
            log.error("Failed to generate async detailed solution: {}", e.getMessage());
            String fallback = "Correct answer: " + correctOption;
            return new SolutionResult(fallback,
                    "### Detailed Solution\nThe correct answer is " + correctOption
                    + ".\n\n*(Generation failed: " + e.getMessage() + ")*");
        }
    }
}

