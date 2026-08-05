package com.pyq.platform.controller;

import com.pyq.platform.entity.AiGenerationLedger;
import com.pyq.platform.entity.Question;
import com.pyq.platform.entity.SystemSettings;
import com.pyq.platform.repository.AiGenerationLedgerRepository;
import com.pyq.platform.repository.SystemSettingsRepository;
import com.pyq.platform.scheduler.NightlyAiQuestionScheduler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/generator")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Slf4j
public class AdminAiGeneratorController {

    private final NightlyAiQuestionScheduler scheduler;
    private final AiGenerationLedgerRepository ledgerRepository;
    private final SystemSettingsRepository settingsRepository;
    private final com.pyq.platform.repository.QuestionRepository questionRepository;
    private final com.pyq.platform.mapper.QuestionMapper questionMapper;
    private final com.pyq.platform.service.AiQuestionGeneratorService generatorService;
    private final com.pyq.platform.service.QuestionService questionService;

    @GetMapping("/questions")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getAiGeneratedQuestions(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String sortDir) {

        org.springframework.data.domain.Sort sort = sortDir.equalsIgnoreCase("asc") 
                ? org.springframework.data.domain.Sort.by(sortBy).ascending() 
                : org.springframework.data.domain.Sort.by(sortBy).descending();
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size, sort);

        org.springframework.data.jpa.domain.Specification<com.pyq.platform.entity.Question> spec = (root, query, cb) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new ArrayList<>();
            
            predicates.add(root.get("pdfSourceName").in("AI_NIGHTLY_GENERATOR", "AI_GENERATED"));

            if (subjectId != null) {
                predicates.add(cb.equal(root.get("subject").get("id"), subjectId));
            }

            if (search != null && !search.trim().isEmpty()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                jakarta.persistence.criteria.Predicate textMatch = cb.like(cb.lower(root.get("text")), pattern);
                jakarta.persistence.criteria.Predicate topicMatch = cb.like(cb.lower(root.get("topic").get("name")), pattern);
                predicates.add(cb.or(textMatch, topicMatch));
            }

            return cb.and(predicates.toArray(new jakarta.persistence.criteria.Predicate[0]));
        };

        org.springframework.data.domain.Page<com.pyq.platform.entity.Question> qPage = questionRepository.findAll(spec, pageable);

        List<com.pyq.platform.dto.QuestionDTO> dtos = qPage.getContent().stream()
                .map(questionMapper::convertToDTO)
                .collect(java.util.stream.Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("content", dtos);
        response.put("pageNo", qPage.getNumber());
        response.put("pageSize", qPage.getSize());
        response.put("totalElements", qPage.getTotalElements());
        response.put("totalPages", qPage.getTotalPages());
        response.put("last", qPage.isLast());

        return ResponseEntity.ok(response);
    }



    @GetMapping("/status")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getGeneratorStatus() {
        Map<String, Object> response = new HashMap<>();

        SystemSettings settings = settingsRepository.findById(1).orElse(new SystemSettings());
        boolean isEnabled = Boolean.TRUE.equals(settings.getAiGeneratorEnabled());
        boolean isRunning = false;
        try {
            isRunning = scheduler.isBatchRunning();
        } catch (Exception ignored) {}

        Long totalAccepted = 0L;
        Long totalRejected = 0L;

        try {
            Object[] counts = ledgerRepository.findTotalCounts();
            if (counts != null && counts.length > 0) {
                Object[] row = (Object[]) (counts[0] instanceof Object[] ? counts[0] : counts);
                if (row.length >= 2) {
                    totalAccepted = row[0] != null ? ((Number) row[0]).longValue() : 0L;
                    totalRejected = row[1] != null ? ((Number) row[1]).longValue() : 0L;
                }
            }
        } catch (Exception ignored) {}

        // Fallback: If ledger count is 0, count actual AI generated questions in database
        if (totalAccepted == 0L) {
            try {
                long nightlyCount = questionRepository.countByPdfSourceName("AI_NIGHTLY_GENERATOR");
                long manualCount = questionRepository.countByPdfSourceName("AI_GENERATED");
                totalAccepted = nightlyCount + manualCount;
            } catch (Exception ignored) {}
        }

        List<Map<String, Object>> ledgerDtos = new ArrayList<>();
        try {
            List<AiGenerationLedger> rawList = ledgerRepository.findAllBalancedPriority();
            if (rawList != null) {
                for (AiGenerationLedger item : rawList) {
                    Map<String, Object> dto = new HashMap<>();
                    dto.put("id", item.getId());
                    dto.put("difficulty", item.getDifficulty());
                    dto.put("questionType", item.getQuestionType());
                    dto.put("totalGenerated", item.getTotalGenerated());
                    dto.put("totalAccepted", item.getTotalAccepted());
                    dto.put("totalRejected", item.getTotalRejected());
                    dto.put("lastGeneratedAt", item.getLastGeneratedAt());
                    if (item.getSubject() != null) {
                        dto.put("subject", Map.of("id", item.getSubject().getId(), "name", item.getSubject().getName()));
                    }
                    if (item.getTopic() != null) {
                        dto.put("topic", Map.of("id", item.getTopic().getId(), "name", item.getTopic().getName()));
                    }
                    ledgerDtos.add(dto);
                }
            }
        } catch (Exception ignored) {}

        response.put("enabled", isEnabled);
        response.put("running", isRunning);
        response.put("startHour", settings.getAiGeneratorStartHour() != null ? settings.getAiGeneratorStartHour() : 0);
        response.put("endHour", settings.getAiGeneratorEndHour() != null ? settings.getAiGeneratorEndHour() : 4);
        response.put("totalAccepted", totalAccepted != null ? totalAccepted : 0);
        response.put("totalRejected", totalRejected != null ? totalRejected : 0);
        response.put("totalTokensUsed", generatorService.getTotalAiGeneratorTokens());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/ledger")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<Map<String, Object>> getPaginatedLedger(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        org.springframework.data.domain.Page<AiGenerationLedger> ledgerPage = ledgerRepository.findAllOrderedByLastGeneratedAtDesc(pageable);

        List<Map<String, Object>> dtos = ledgerPage.getContent().stream().map(item -> {
            Map<String, Object> dto = new HashMap<>();
            dto.put("id", item.getId());
            dto.put("difficulty", item.getDifficulty());
            dto.put("questionType", item.getQuestionType());
            dto.put("totalGenerated", item.getTotalGenerated());
            dto.put("totalAccepted", item.getTotalAccepted());
            dto.put("totalRejected", item.getTotalRejected());
            dto.put("lastGeneratedAt", item.getLastGeneratedAt());
            if (item.getSubject() != null) {
                dto.put("subject", Map.of("id", item.getSubject().getId(), "name", item.getSubject().getName()));
            }
            if (item.getTopic() != null) {
                dto.put("topic", Map.of("id", item.getTopic().getId(), "name", item.getTopic().getName()));
            }
            return dto;
        }).collect(java.util.stream.Collectors.toList());

        Map<String, Object> response = new HashMap<>();
        response.put("content", dtos);
        response.put("pageNo", ledgerPage.getNumber());
        response.put("pageSize", ledgerPage.getSize());
        response.put("totalElements", ledgerPage.getTotalElements());
        response.put("totalPages", ledgerPage.getTotalPages());
        response.put("last", ledgerPage.isLast());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/subject-summary")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<List<Map<String, Object>>> getSubjectSummary() {
        List<Object[]> summaries = questionRepository.getAiQuestionSubjectSummaries();
        List<Map<String, Object>> result = new ArrayList<>();

        for (Object[] row : summaries) {
            String subName = row[0] != null ? String.valueOf(row[0]) : "General CS";
            long totalCount = row[1] != null ? ((Number) row[1]).longValue() : 0L;
            long pendingCount = row[2] != null ? ((Number) row[2]).longValue() : 0L;
            long approvedCount = row[3] != null ? ((Number) row[3]).longValue() : 0L;

            Map<String, Object> map = new HashMap<>();
            map.put("subjectName", subName);
            map.put("totalCount", totalCount);
            map.put("pendingCount", pendingCount);
            map.put("approvedCount", approvedCount);
            result.add(map);
        }

        result.sort((a, b) -> String.valueOf(a.get("subjectName")).compareTo(String.valueOf(b.get("subjectName"))));
        return ResponseEntity.ok(result);
    }

    @PostMapping("/toggle")
    public ResponseEntity<Map<String, Object>> toggleGenerator(@RequestParam boolean enabled) {
        SystemSettings settings = settingsRepository.findById(1).orElseGet(() -> SystemSettings.builder().id(1).build());
        settings.setAiGeneratorEnabled(enabled);
        settingsRepository.save(settings);

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("enabled", enabled);
        response.put("message", enabled ? "AI Practice Question Generator is ENABLED" : "AI Practice Question Generator is PAUSED");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/test-run")
    public ResponseEntity<Map<String, Object>> triggerTestRun(
            @RequestParam(defaultValue = "MIXED") String difficulty,
            @RequestParam(defaultValue = "MIXED") String type,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) Long topicId,
            @RequestParam(defaultValue = "5") int count) {
        if (scheduler.isBatchRunning()) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", "Generator batch is already running!");
            return ResponseEntity.badRequest().body(err);
        }

        final int targetCount = Math.max(1, Math.min(count, 25));
        new Thread(() -> {
            log.info("🚀 [Admin Generator Trigger] Starting manual batch run. Count: {}, Diff: {}, Type: {}, SubjectId: {}, TopicId: {}",
                    targetCount, difficulty, type, subjectId, topicId);
            for (int i = 0; i < targetCount; i++) {
                try {
                    generatorService.generateAndVerifySingleQuestion(difficulty, type, subjectId, topicId);
                    Thread.sleep(3000); // 3s pacing delay
                } catch (Exception e) {
                    log.error("Error during manual trigger generation", e);
                }
            }
        }).start();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", String.format("Triggered AI Generator batch (%d questions, Diff: %s, Type: %s). Check ledger in a few seconds!", targetCount, difficulty, type));
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/batch-delete")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Map<String, Object>> batchDeleteQuestions(@RequestParam(required = false) Long subjectId, @RequestBody(required = false) List<Long> questionIds) {
        Map<String, Object> res = new HashMap<>();
        if (questionIds != null && !questionIds.isEmpty()) {
            questionService.deleteQuestionsWithDependencies(questionIds);
            res.put("message", "Deleted " + questionIds.size() + " selected questions!");
        } else if (subjectId != null) {
            List<com.pyq.platform.entity.Question> list1 = questionRepository.findBySubjectIdAndPdfSourceName(subjectId, "AI_NIGHTLY_GENERATOR");
            List<com.pyq.platform.entity.Question> list2 = questionRepository.findBySubjectIdAndPdfSourceName(subjectId, "AI_GENERATED");
            List<Long> ids = new ArrayList<>();
            if (list1 != null) list1.forEach(q -> ids.add(q.getId()));
            if (list2 != null) list2.forEach(q -> ids.add(q.getId()));
            questionService.deleteQuestionsWithDependencies(ids);
            res.put("message", "Deleted " + ids.size() + " AI questions for selected subject!");
        } else {
            List<com.pyq.platform.entity.Question> list1 = questionRepository.findByPdfSourceName("AI_NIGHTLY_GENERATOR");
            List<com.pyq.platform.entity.Question> list2 = questionRepository.findByPdfSourceName("AI_GENERATED");
            List<Long> ids = new ArrayList<>();
            if (list1 != null) list1.forEach(q -> ids.add(q.getId()));
            if (list2 != null) list2.forEach(q -> ids.add(q.getId()));
            questionService.deleteQuestionsWithDependencies(ids);
            res.put("message", "All " + ids.size() + " AI Generated questions deleted!");
        }
        res.put("success", true);
        return ResponseEntity.ok(res);
    }

    @DeleteMapping("/clear-ledger")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Map<String, Object>> clearLedger() {
        ledgerRepository.deleteAll();
        generatorService.resetTokens();
        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("message", "AI Generator history ledger and token counter cleared successfully!");
        return ResponseEntity.ok(res);
    }
}
