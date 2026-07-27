package com.pyq.platform.controller;

import com.pyq.platform.entity.AiGenerationLedger;
import com.pyq.platform.entity.SystemSettings;
import com.pyq.platform.repository.AiGenerationLedgerRepository;
import com.pyq.platform.repository.SystemSettingsRepository;
import com.pyq.platform.scheduler.NightlyAiQuestionScheduler;
import lombok.RequiredArgsConstructor;
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
public class AdminAiGeneratorController {

    private final NightlyAiQuestionScheduler scheduler;
    private final AiGenerationLedgerRepository ledgerRepository;
    private final SystemSettingsRepository settingsRepository;
    private final com.pyq.platform.repository.QuestionRepository questionRepository;
    private final com.pyq.platform.mapper.QuestionMapper questionMapper;
    private final com.pyq.platform.service.AiQuestionGeneratorService generatorService;

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
        List<AiGenerationLedger> ledgerList = List.of();

        try {
            totalAccepted = ledgerRepository.countTotalAcceptedQuestions();
        } catch (Exception ignored) {}

        try {
            totalRejected = ledgerRepository.countTotalRejectedQuestions();
        } catch (Exception ignored) {}

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
        response.put("ledger", ledgerDtos);

        return ResponseEntity.ok(response);
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
    public ResponseEntity<Map<String, Object>> triggerTestRun() {
        if (scheduler.isBatchRunning()) {
            Map<String, Object> err = new HashMap<>();
            err.put("success", false);
            err.put("message", "Generator batch is already running!");
            return ResponseEntity.badRequest().body(err);
        }

        // Run sample 5 questions in background thread
        new Thread(() -> scheduler.runBatchLoop(true)).start();

        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("message", "Triggered sample test batch (5 questions). Check ledger in a few seconds!");
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/batch-delete")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<Map<String, Object>> batchDeleteQuestions(@RequestParam(required = false) Long subjectId, @RequestBody(required = false) List<Long> questionIds) {
        Map<String, Object> res = new HashMap<>();
        if (questionIds != null && !questionIds.isEmpty()) {
            questionRepository.deleteAllById(questionIds);
            res.put("message", "Deleted " + questionIds.size() + " selected questions!");
        } else if (subjectId != null) {
            questionRepository.deleteBySubjectIdAndPdfSourceName(subjectId, "AI_NIGHTLY_GENERATOR");
            questionRepository.deleteBySubjectIdAndPdfSourceName(subjectId, "AI_GENERATED");
            res.put("message", "Deleted all AI questions for selected subject!");
        } else {
            questionRepository.deleteByPdfSourceName("AI_NIGHTLY_GENERATOR");
            questionRepository.deleteByPdfSourceName("AI_GENERATED");
            res.put("message", "All AI Generated questions deleted!");
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
