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
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;
    private final TagRepository tagRepository;
    private final QuestionRepository questionRepository;
    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final PasswordEncoder passwordEncoder;

    public DataInitializer(UserRepository userRepository, SubjectRepository subjectRepository,
                           TopicRepository topicRepository, TagRepository tagRepository,
                           QuestionRepository questionRepository, QuestionAIAnalysisRepository aiAnalysisRepository,
                           PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.tagRepository = tagRepository;
        this.questionRepository = questionRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
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
                            Long parentId = t.getParentTopic() != null ? t.getParentTopic().getId() : null;
                            Optional<Topic> existingCanonical = parentId != null
                                    ? topicRepository.findByNameAndSubjectIdAndParentTopicId(t.getName(), targetSub.getId(), parentId)
                                    : topicRepository.findByNameAndSubjectIdAndParentTopicIsNull(t.getName(), targetSub.getId());

                            if (existingCanonical.isPresent()) {
                                Topic canonicalTopic = existingCanonical.get();
                                log.info("🔧 Self-Healing DB: Merging duplicate Topic '{}' (ID {}) into Canonical Topic (ID {}) under Subject '{}'",
                                        t.getName(), t.getId(), canonicalTopic.getId(), targetSub.getName());
                                questionRepository.relinkQuestionsToTopic(t.getId(), canonicalTopic, targetSub);
                                try {
                                    topicRepository.delete(t);
                                } catch (Exception ignored) {}
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
}
