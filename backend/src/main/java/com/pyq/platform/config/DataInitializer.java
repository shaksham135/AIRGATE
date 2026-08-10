package com.pyq.platform.config;

import com.pyq.platform.entity.*;
import com.pyq.platform.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;
    private final TagRepository tagRepository;
    private final QuestionRepository questionRepository;
    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final SystemSettingsRepository systemSettingsRepository;
    private final PasswordEncoder passwordEncoder;
    private final org.springframework.jdbc.core.JdbcTemplate jdbcTemplate;

    public DataInitializer(UserRepository userRepository, SubjectRepository subjectRepository,
                           TopicRepository topicRepository, TagRepository tagRepository,
                           QuestionRepository questionRepository, QuestionAIAnalysisRepository aiAnalysisRepository,
                           SystemSettingsRepository systemSettingsRepository,
                           PasswordEncoder passwordEncoder,
                           org.springframework.jdbc.core.JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.tagRepository = tagRepository;
        this.questionRepository = questionRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.systemSettingsRepository = systemSettingsRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) throws Exception {
        // 0. Run Self-Healing Schema Migrations before any JPA Repository queries
        runSchemaMigrations();

        // Ensure SystemSettings Singleton Record (ID = 1) exists
        SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
        if (settings == null) {
            settings = SystemSettings.builder()
                    .id(1)
                    .premiumPriceInr(new java.math.BigDecimal("199.00"))
                    .premiumDurationMonths(1)
                    .aiDailyLimitPremium(100)
                    .isMaintenanceMode(false)
                    .tier1PriceInr(new java.math.BigDecimal("99.00"))
                    .tier1DurationMonths(1)
                    .tier1SpecialOffer("Best for quick revisions")
                    .tier2PriceInr(new java.math.BigDecimal("249.00"))
                    .tier2DurationMonths(3)
                    .tier2SpecialOffer("Save 15% - Most Popular")
                    .tier3PriceInr(new java.math.BigDecimal("449.00"))
                    .tier3DurationMonths(6)
                    .tier3SpecialOffer("Save 25% - Complete Prep")
                    .betaPaymentEnabled(true)
                    .betaUpiId("airgate@upi")
                    .betaSpotsRemaining(100)
                    .betaTier1Price(new java.math.BigDecimal("49.00"))
                    .betaTier2Price(new java.math.BigDecimal("249.00"))
                    .build();
            systemSettingsRepository.save(settings);
        } else {
            // Self-healing: ensure beta fields are initialized
            boolean updated = false;
            if (settings.getBetaPaymentEnabled() == null) { settings.setBetaPaymentEnabled(true); updated = true; }
            if (settings.getBetaUpiId() == null || settings.getBetaUpiId().isBlank()) { settings.setBetaUpiId("airgate@upi"); updated = true; }
            if (settings.getBetaSpotsRemaining() == null) { settings.setBetaSpotsRemaining(100); updated = true; }
            if (settings.getBetaTier1Price() == null) { settings.setBetaTier1Price(new java.math.BigDecimal("49.00")); updated = true; }
            if (settings.getBetaTier2Price() == null) { settings.setBetaTier2Price(new java.math.BigDecimal("249.00")); updated = true; }
            if (updated) {
                systemSettingsRepository.save(settings);
                log.info("⚙️ DataInitializer: Updated SystemSettings with VIP Beta defaults.");
            }
        }
        log.info("⚙️ Initialized SystemSettings singleton configuration in DB.");

        // 1. Always Ensure Admin User from Environment Variables
        String adminUser  = resolvePassword("ADMIN_USERNAME",   "admin");
        String adminEmail = resolvePassword("ADMIN_EMAIL",      "admin@airgate.in");
        String adminPwd   = resolvePassword("ADMIN_PASSWORD",   "ChangeMe_Admin@2025!");

        User admin = userRepository.findByUsername(adminUser)
                .or(() -> userRepository.findByEmail(adminEmail))
                .orElse(new User());

        admin.setUsername(adminUser);
        admin.setEmail(adminEmail);
        admin.setPasswordHash(passwordEncoder.encode(adminPwd));
        admin.setRole(User.UserRole.ADMIN);
        userRepository.save(admin);
        log.info("Admin user '{}' successfully synced with ENV credentials.", adminUser);

        // Seed default secondary test accounts if table is empty
        if (userRepository.count() <= 1) {
            String editorPwd  = resolvePassword("EDITOR_PASSWORD",  "ChangeMe_Editor@2025!");
            String studentPwd = resolvePassword("STUDENT_PASSWORD", "ChangeMe_Student@2025!");

            if (!userRepository.existsByUsername("editor")) {
                userRepository.save(User.builder()
                        .username("editor")
                        .email("editor@pyqplatform.com")
                        .passwordHash(passwordEncoder.encode(editorPwd))
                        .role(User.UserRole.EDITOR)
                        .build());
            }

            if (!userRepository.existsByUsername("student")) {
                userRepository.save(User.builder()
                        .username("student")
                        .email("student@pyqplatform.com")
                        .passwordHash(passwordEncoder.encode(studentPwd))
                        .role(User.UserRole.STUDENT)
                        .build());
            }
        }

        // 2. Seed Subjects and Topics
        if (subjectRepository.count() == 0) {
            log.info("Seeding standard GATE CSE subjects and topics...");
            
            // Engineering Mathematics
            Subject engMath = subjectRepository.save(Subject.builder().name("Engineering Mathematics").build());
            topicRepository.save(Topic.builder().name("Linear Algebra").subject(engMath).build());
            topicRepository.save(Topic.builder().name("Calculus").subject(engMath).build());
            topicRepository.save(Topic.builder().name("Probability & Statistics").subject(engMath).build());

            // Discrete Mathematics
            Subject discMath = subjectRepository.save(Subject.builder().name("Discrete Mathematics").build());
            topicRepository.save(Topic.builder().name("Mathematical Logic").subject(discMath).build());
            topicRepository.save(Topic.builder().name("Set Theory & Relations").subject(discMath).build());
            topicRepository.save(Topic.builder().name("Combinatorics").subject(discMath).build());
            topicRepository.save(Topic.builder().name("Graph Theory").subject(discMath).build());

            // Digital Logic
            Subject digLogic = subjectRepository.save(Subject.builder().name("Digital Logic").build());
            topicRepository.save(Topic.builder().name("Boolean Algebra").subject(digLogic).build());
            topicRepository.save(Topic.builder().name("Combinational Circuits").subject(digLogic).build());
            topicRepository.save(Topic.builder().name("Sequential Circuits").subject(digLogic).build());

            // Computer Organization
            Subject coa = subjectRepository.save(Subject.builder().name("Computer Organization and Architecture").build());
            topicRepository.save(Topic.builder().name("Machine Instructions & Addressing").subject(coa).build());
            topicRepository.save(Topic.builder().name("ALU & Data Path").subject(coa).build());
            topicRepository.save(Topic.builder().name("Instruction Pipelining").subject(coa).build());
            topicRepository.save(Topic.builder().name("Memory Hierarchy").subject(coa).build());

            // Programming & Data Structures
            Subject progDS = subjectRepository.save(Subject.builder().name("Programming and Data Structures").build());
            topicRepository.save(Topic.builder().name("Programming in C").subject(progDS).build());
            topicRepository.save(Topic.builder().name("Recursion").subject(progDS).build());
            topicRepository.save(Topic.builder().name("Stacks, Queues & Linked Lists").subject(progDS).build());
            topicRepository.save(Topic.builder().name("Trees & Binary Heaps").subject(progDS).build());

            // Algorithms
            Subject algo = subjectRepository.save(Subject.builder().name("Algorithms").build());
            topicRepository.save(Topic.builder().name("Searching & Sorting").subject(algo).build());
            topicRepository.save(Topic.builder().name("Asymptotic Complexity").subject(algo).build());
            topicRepository.save(Topic.builder().name("Greedy & Dynamic Programming").subject(algo).build());
            topicRepository.save(Topic.builder().name("Graph Algorithms").subject(algo).build());

            // Theory of Computation
            Subject toc = subjectRepository.save(Subject.builder().name("Theory of Computation").build());
            topicRepository.save(Topic.builder().name("Finite Automata & Regular Lang").subject(toc).build());
            topicRepository.save(Topic.builder().name("Context Free Grammars & PDA").subject(toc).build());
            topicRepository.save(Topic.builder().name("Turing Machines & Undecidability").subject(toc).build());

            // Compiler Design
            Subject cd = subjectRepository.save(Subject.builder().name("Compiler Design").build());
            topicRepository.save(Topic.builder().name("Lexical Analysis & Parsing").subject(cd).build());
            topicRepository.save(Topic.builder().name("Syntax Directed Translation").subject(cd).build());
            topicRepository.save(Topic.builder().name("Code Optimization").subject(cd).build());

            // Operating System
            Subject os = subjectRepository.save(Subject.builder().name("Operating System").build());
            topicRepository.save(Topic.builder().name("System Calls & Processes").subject(os).build());
            topicRepository.save(Topic.builder().name("CPU Scheduling").subject(os).build());
            topicRepository.save(Topic.builder().name("Memory Management").subject(os).build());
            topicRepository.save(Topic.builder().name("Virtual Memory & Deadlocks").subject(os).build());

            // Databases
            Subject db = subjectRepository.save(Subject.builder().name("Databases").build());
            topicRepository.save(Topic.builder().name("ER & Relational Model").subject(db).build());
            topicRepository.save(Topic.builder().name("SQL & Relational Algebra").subject(db).build());
            topicRepository.save(Topic.builder().name("Normal Forms").subject(db).build());
            topicRepository.save(Topic.builder().name("Transactions & Concurrency").subject(db).build());

            // Computer Networks
            Subject cn = subjectRepository.save(Subject.builder().name("Computer Networks").build());
            topicRepository.save(Topic.builder().name("OSI & TCP/IP Layers").subject(cn).build());
            topicRepository.save(Topic.builder().name("Flow & Error Control").subject(cn).build());
            topicRepository.save(Topic.builder().name("Routing Algorithms").subject(cn).build());
            topicRepository.save(Topic.builder().name("TCP/UDP & Congestion Control").subject(cn).build());

            // General Aptitude
            Subject apt = subjectRepository.save(Subject.builder().name("General Aptitude").build());
            topicRepository.save(Topic.builder().name("Quantitative Aptitude").subject(apt).build());
            topicRepository.save(Topic.builder().name("Verbal & Spatial Aptitude").subject(apt).build());
        }

        // 3. Automatic Database Self-Healing: Align all topics & questions with canonical GATE CSE subjects
        try {
            Map<String, String> topicToCanonicalSubjectMap = new HashMap<>();

            // Operating Systems
            topicToCanonicalSubjectMap.put("Process Scheduling", "Operating System");
            topicToCanonicalSubjectMap.put("CPU Scheduling", "Operating System");
            topicToCanonicalSubjectMap.put("System Calls & Processes", "Operating System");
            topicToCanonicalSubjectMap.put("Memory Management", "Operating System");
            topicToCanonicalSubjectMap.put("Virtual Memory & Deadlocks", "Operating System");

            // Discrete Mathematics
            topicToCanonicalSubjectMap.put("Predicate Logic", "Discrete Mathematics");
            topicToCanonicalSubjectMap.put("Mathematical Logic", "Discrete Mathematics");
            topicToCanonicalSubjectMap.put("Propositional Logic", "Discrete Mathematics");
            topicToCanonicalSubjectMap.put("Set Theory & Relations", "Discrete Mathematics");
            topicToCanonicalSubjectMap.put("Combinatorics", "Discrete Mathematics");
            topicToCanonicalSubjectMap.put("Graph Theory", "Discrete Mathematics");

            // Digital Logic
            topicToCanonicalSubjectMap.put("Digital Logic", "Digital Logic");
            topicToCanonicalSubjectMap.put("Boolean Algebra", "Digital Logic");
            topicToCanonicalSubjectMap.put("Combinational Circuits", "Digital Logic");
            topicToCanonicalSubjectMap.put("Sequential Circuits", "Digital Logic");
            topicToCanonicalSubjectMap.put("Number Representation", "Digital Logic");
            topicToCanonicalSubjectMap.put("Number Representation & Computer Arithmetic", "Digital Logic");
            topicToCanonicalSubjectMap.put("2’s Complement Representation", "Digital Logic");

            // Engineering Mathematics
            topicToCanonicalSubjectMap.put("Linear Algebra", "Engineering Mathematics");
            topicToCanonicalSubjectMap.put("Calculus", "Engineering Mathematics");
            topicToCanonicalSubjectMap.put("Probability & Statistics", "Engineering Mathematics");

            for (Map.Entry<String, String> entry : topicToCanonicalSubjectMap.entrySet()) {
                String topicName = entry.getKey();
                String targetSubjectName = entry.getValue();

                Optional<Subject> targetSubOpt = subjectRepository.findByName(targetSubjectName);
                if (targetSubOpt.isPresent()) {
                    Subject targetSub = targetSubOpt.get();
                    List<Topic> topicsToFix = topicRepository.findByName(topicName);
                    for (Topic t : topicsToFix) {
                        if (t.getSubject() != null && !t.getSubject().getId().equals(targetSub.getId())) {
                            List<Topic> existingInTarget = topicRepository.findByName(t.getName());
                            Optional<Topic> existingCanonical = existingInTarget.stream()
                                    .filter(existing -> existing.getSubject() != null && existing.getSubject().getId().equals(targetSub.getId()))
                                    .findFirst();

                            if (existingCanonical.isPresent()) {
                                Topic canonicalTopic = existingCanonical.get();
                                log.info("🔧 Self-Healing DB: Merging duplicate Topic '{}' (ID {}) into Canonical Topic (ID {}) under Subject '{}'",
                                        t.getName(), t.getId(), canonicalTopic.getId(), targetSub.getName());
                                questionRepository.relinkQuestionsToTopic(t.getId(), canonicalTopic, targetSub);
                                topicRepository.relinkChildTopics(t.getId(), canonicalTopic);
                                try {
                                    topicRepository.deleteById(t.getId());
                                } catch (Exception e) {
                                    log.warn("🔧 Self-Healing DB: Could not delete merged Topic ID {} due to foreign key constraints: {}", t.getId(), e.getMessage());
                                }
                            } else {
                                log.info("🔧 Self-Healing DB: Re-assigning Topic '{}' from Subject '{}' -> '{}'",
                                        t.getName(), t.getSubject().getName(), targetSub.getName());
                                t.setSubject(targetSub);
                                topicRepository.save(t);
                            }
                        }
                    }
                }
            }

            // Sync any misaligned question.subject_id with question.topic.subject_id
            int updatedCount = questionRepository.alignQuestionSubjectsWithTopics();
            if (updatedCount > 0) {
                log.info("🔧 Self-Healing DB: Aligned {} questions with their correct canonical topic subjects!", updatedCount);
            }

            // Self-Healing DB: Assign branch, paperSet, questionNumber for SEO URLs
            List<Question> unnumbered = questionRepository.findAll();
            int assignedCount = 0;
            java.util.Map<String, Integer> gateCounter = new java.util.HashMap<>();
            java.util.Map<Long, Integer> practiceCounter = new java.util.HashMap<>();

            for (Question q : unnumbered) {
                boolean changed = false;
                if (q.getBranch() == null || q.getBranch().isBlank()) {
                    q.setBranch("cse");
                    changed = true;
                }
                if (q.getPaperSet() == null) {
                    q.setPaperSet(1);
                    changed = true;
                }
                if (q.getQuestionNumber() == null) {
                    String pdfSource = q.getPdfSourceName();
                    boolean isAiPractice = pdfSource != null && (
                            pdfSource.toLowerCase().startsWith("ai_nightly") ||
                            pdfSource.toLowerCase().startsWith("ai_generated") ||
                            pdfSource.toLowerCase().contains("practice")
                    );
                    if (isAiPractice) {
                        Long subId = q.getSubject() != null ? q.getSubject().getId() : 0L;
                        int nextNum = practiceCounter.getOrDefault(subId, 0) + 1;
                        practiceCounter.put(subId, nextNum);
                        q.setQuestionNumber(nextNum);
                    } else {
                        String key = q.getBranch() + "_" + (q.getYear() != null ? q.getYear() : 2025) + "_" + q.getPaperSet();
                        int nextNum = gateCounter.getOrDefault(key, 0) + 1;
                        gateCounter.put(key, nextNum);
                        q.setQuestionNumber(nextNum);
                    }
                    changed = true;
                }
                if (changed) {
                    questionRepository.save(q);
                    assignedCount++;
                }
            }
            if (assignedCount > 0) {
                log.info("🔧 Self-Healing DB: Assigned SEO branch/paperSet/questionNumber for {} questions!", assignedCount);
            }
        } catch (Exception e) {
            log.warn("Failed to run topic self-healing check: {}", e.getMessage());
        }
    }

    /**
     * Resolves a password from an env var. Falls back to {@code fallback} only in dev.
     * In production the env var must be set — log a warning if the fallback is used.
     */
    private String resolvePassword(String envVar, String fallback) {
        String val = System.getenv(envVar);
        if (val != null && !val.isBlank()) {
            return val;
        }
        log.warn("DataInitializer: env var '{}' not set — using built-in fallback password. Set this in production!", envVar);
        return fallback;
    }

    private void runSchemaMigrations() {
        log.info("🔧 Running Self-Healing Database Schema Migrations for Production MySQL/TiDB...");
        
        // Add branch, paper_set, question_number columns to questions table if missing
        addMissingColumn("questions", "branch", "VARCHAR(32) DEFAULT 'cse'");
        addMissingColumn("questions", "paper_set", "INT DEFAULT 1");
        addMissingColumn("questions", "question_number", "INT");

        // Add VIP Beta payment columns to system_settings table if missing
        addMissingColumn("system_settings", "beta_payment_enabled", "BOOLEAN DEFAULT TRUE");
        addMissingColumn("system_settings", "beta_upi_id", "VARCHAR(255) DEFAULT 'airgate@upi'");
        addMissingColumn("system_settings", "beta_qr_image_url", "TEXT");
        addMissingColumn("system_settings", "beta_spots_remaining", "INT DEFAULT 100");
        addMissingColumn("system_settings", "beta_tier1_price", "DECIMAL(10,2) DEFAULT 49.00");
        addMissingColumn("system_settings", "beta_tier2_price", "DECIMAL(10,2) DEFAULT 149.00");
        addMissingColumn("system_settings", "beta_tier3_price", "DECIMAL(10,2) DEFAULT 249.00");
        addMissingColumn("system_settings", "beta_banner_heading", "VARCHAR(255)");
        addMissingColumn("system_settings", "beta_banner_subheading", "TEXT");
        addMissingColumn("system_settings", "beta_tier1_offer", "VARCHAR(255)");
        addMissingColumn("system_settings", "beta_tier2_offer", "VARCHAR(255)");
        addMissingColumn("system_settings", "beta_tier3_offer", "VARCHAR(255)");
        addMissingColumn("system_settings", "frontend_base_url", "VARCHAR(255) DEFAULT 'https://airgate.in'");

        // Create payment_verifications table if missing
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS payment_verifications (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id BIGINT NOT NULL,
                    plan_type VARCHAR(64) NOT NULL,
                    duration_months INT NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    utr_number VARCHAR(64) NOT NULL,
                    screenshot_url TEXT,
                    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
                    admin_notes TEXT,
                    created_at DATETIME NOT NULL,
                    updated_at DATETIME,
                    CONSTRAINT fk_payment_verifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """);

            addIndexSafely("payment_verifications", "idx_pv_utr", "utr_number");
            addIndexSafely("payment_verifications", "idx_pv_status_created", "status, created_at");
            addIndexSafely("payment_verifications", "idx_pv_user_status", "user_id, status, created_at");
            addIndexSafely("questions", "idx_q_seo_routing", "branch, year, paper_set, question_number");
        } catch (Exception e) {
            log.warn("Schema Migration Note: payment_verifications table creation: {}", e.getMessage());
        }
    }

    private void addIndexSafely(String table, String indexName, String columns) {
        try {
            jdbcTemplate.execute("CREATE INDEX " + indexName + " ON " + table + "(" + columns + ")");
        } catch (Exception ignored) {
            // Index already exists or created by Flyway migration
        }
    }

    private void addMissingColumn(String tableName, String columnName, String columnDefinition) {
        try {
            jdbcTemplate.execute("ALTER TABLE " + tableName + " ADD COLUMN " + columnName + " " + columnDefinition);
            log.info("✅ Self-Healing DB: Successfully added missing column '{}.{}' to production database.", tableName, columnName);
        } catch (Exception e) {
            // Column already exists or matches schema
        }
    }
}
