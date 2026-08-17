package com.pyq.platform.controller;

import com.pyq.platform.entity.*;
import com.pyq.platform.repository.MockAttemptRepository;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import lombok.Data;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/simulator")
@Slf4j
public class MockAttemptController {

    private final MockAttemptRepository mockAttemptRepository;
    private final UserRepository userRepository;
    private final QuestionRepository questionRepository;

    public MockAttemptController(MockAttemptRepository mockAttemptRepository,
                                 UserRepository userRepository,
                                 QuestionRepository questionRepository) {
        this.mockAttemptRepository = mockAttemptRepository;
        this.userRepository = userRepository;
        this.questionRepository = questionRepository;
    }

    @PostMapping("/submit")
    @PreAuthorize("isAuthenticated()")
    @org.springframework.cache.annotation.CacheEvict(value = "mockHistory", key = "#userDetails.id")
    public ResponseEntity<?> submitMockAttempt(
            @RequestBody MockAttemptSubmissionDTO dto,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        try {
            User user = userRepository.findById(userDetails.getId()).orElseThrow();

            LocalDateTime start;
            LocalDateTime end;
            try {
                start = LocalDateTime.parse(dto.getStartedAt(), DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception e) {
                start = LocalDateTime.now().minusSeconds(dto.getTimeTakenSeconds());
            }
            try {
                end = LocalDateTime.parse(dto.getSubmittedAt(), DateTimeFormatter.ISO_DATE_TIME);
            } catch (Exception e) {
                end = LocalDateTime.now();
            }

            // Server-side Score Recalculation (Anti-Cheat)
            double serverScore = 0.0;
            double negativeWastage = 0.0;
            int correctCount = 0;
            int incorrectCount = 0;
            int skippedCount = 0;

            List<MockAttemptAnswer> attemptAnswers = new ArrayList<>();

            MockAttempt attempt = MockAttempt.builder()
                    .user(user)
                    .startedAt(start)
                    .submittedAt(end)
                    .timeTakenSeconds(dto.getTimeTakenSeconds())
                    .totalQuestions(dto.getTotalQuestions())
                    .autoSubmitted(dto.getAutoSubmitted() != null ? dto.getAutoSubmitted() : false)
                    .mode(dto.getMode() != null ? dto.getMode() : "FULL_MOCK")
                    .build();

            if (dto.getAnswers() != null && !dto.getAnswers().isEmpty()) {
                List<Long> qIds = dto.getAnswers().stream()
                        .map(MockAttemptAnswerDTO::getQuestionId)
                        .filter(Objects::nonNull)
                        .collect(Collectors.toList());

                Map<Long, Question> questionMap = questionRepository.findAllById(qIds).stream()
                        .collect(Collectors.toMap(Question::getId, q -> q));

                for (MockAttemptAnswerDTO aDto : dto.getAnswers()) {
                    Question q = questionMap.get(aDto.getQuestionId());
                    if (q != null) {
                        String userAns = aDto.getSelectedAnswer();
                        boolean isCorrect = false;
                        double marksAwarded = 0.0;

                        if (userAns == null || userAns.isBlank()) {
                            skippedCount++;
                        } else {
                            isCorrect = isAnswerCorrect(q, userAns);
                            int qMarks = (q.getMarks() != null && q.getMarks() > 0) ? q.getMarks() : 1;

                            if (isCorrect) {
                                correctCount++;
                                marksAwarded = qMarks;
                                serverScore += qMarks;
                            } else {
                                incorrectCount++;
                                if ("MCQ".equalsIgnoreCase(q.getQuestionType())) {
                                    double penalty = qMarks == 1 ? (1.0 / 3.0) : (2.0 / 3.0);
                                    marksAwarded = -penalty;
                                    serverScore -= penalty;
                                    negativeWastage += penalty;
                                }
                            }
                        }

                        MockAttemptAnswer answer = MockAttemptAnswer.builder()
                                .attempt(attempt)
                                .question(q)
                                .selectedAnswer(userAns)
                                .isCorrect(isCorrect)
                                .marksAwarded(marksAwarded)
                                .build();
                        attemptAnswers.add(answer);
                    }
                }
            }

            serverScore = Math.max(0.0, Math.round(serverScore * 100.0) / 100.0);
            negativeWastage = Math.round(negativeWastage * 100.0) / 100.0;

            attempt.setScore(serverScore);
            attempt.setCorrectCount(correctCount);
            attempt.setIncorrectCount(incorrectCount);
            attempt.setSkippedCount(skippedCount);
            attempt.setNegativeWastage(negativeWastage);

            // Compute Percentile & Estimated All-India Rank (AIR)
            long totalMockAttempts = mockAttemptRepository.countFullMockAttempts() + 1;
            long lowerAttempts = mockAttemptRepository.countFullMockAttemptsWithScoreLessThanOrEqual(serverScore) + 1;
            double percentile = Math.min(99.9, Math.max(1.0, ((double) lowerAttempts / (double) totalMockAttempts) * 100.0));
            percentile = Math.round(percentile * 100.0) / 100.0;

            int totalGateCandidates = 110000;
            int estimatedRank = (int) Math.max(1, Math.round(((100.0 - percentile) / 100.0) * totalGateCandidates));

            attempt.setPercentile(percentile);
            attempt.setEstimatedRank(estimatedRank);
            attempt.setAnswers(attemptAnswers);

            mockAttemptRepository.save(attempt);

            String cutoffStatus = serverScore >= 28.5 ? "QUALIFIED (General)" 
                                : serverScore >= 25.6 ? "QUALIFIED (OBC/EWS)" 
                                : serverScore >= 19.0 ? "QUALIFIED (SC/ST)" 
                                : "NOT QUALIFIED";

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "attemptId", attempt.getId(),
                    "score", serverScore,
                    "correctCount", correctCount,
                    "incorrectCount", incorrectCount,
                    "skippedCount", skippedCount,
                    "negativeWastage", negativeWastage,
                    "percentile", percentile,
                    "estimatedRank", estimatedRank,
                    "cutoffStatus", cutoffStatus
            ));
        } catch (Exception e) {
            log.error("Failed to submit mock attempt: {}", e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save mock attempt: " + e.getMessage()));
        }
    }

    private boolean isAnswerCorrect(Question q, String userAns) {
        if (userAns == null || userAns.isBlank()) return false;
        String correct = q.getAiSuggestedAnswer();
        if (correct == null || correct.isBlank()) return false;

        String c = correct.trim().toLowerCase().replaceFirst("^(option\\s+)", "");
        String s = userAns.trim().toLowerCase().replaceFirst("^(option\\s+)", "");
        if (c.equals(s)) return true;

        if ("MSQ".equalsIgnoreCase(q.getQuestionType())) {
            String cLetters = c.toUpperCase().replaceAll("[^A-D]", "");
            char[] cArr = cLetters.toCharArray();
            Arrays.sort(cArr);
            String sLetters = s.toUpperCase().replaceAll("[^A-D]", "");
            char[] sArr = sLetters.toCharArray();
            Arrays.sort(sArr);
            return new String(cArr).equals(new String(sArr)) && cArr.length > 0;
        }

        try {
            double sVal = Double.parseDouble(s);
            String[] parts = c.split("[-:to]+");
            if (parts.length == 2) {
                double min = Double.parseDouble(parts[0].trim());
                double max = Double.parseDouble(parts[1].trim());
                return sVal >= min && sVal <= max;
            } else if (parts.length == 1) {
                double cVal = Double.parseDouble(c);
                return Math.abs(cVal - sVal) < 1e-4;
            }
        } catch (Exception ignored) {}

        return false;
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "mockHistory", key = "#userDetails.id")
    public ResponseEntity<?> getMockHistory(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            List<MockAttempt> attempts = mockAttemptRepository.findByUserIdOrderBySubmittedAtDesc(userDetails.getId());
            return ResponseEntity.ok(attempts);
        } catch (Exception e) {
            log.error("Failed to fetch mock history: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to fetch mock history"));
        }
    }

    @DeleteMapping("/history")
    @PreAuthorize("isAuthenticated()")
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.cache.annotation.CacheEvict(value = "mockHistory", key = "#userDetails.id")
    public ResponseEntity<?> clearMockHistory(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            mockAttemptRepository.deleteByUserId(userDetails.getId());
            return ResponseEntity.ok(Map.of("message", "Mock history cleared successfully"));
        } catch (Exception e) {
            log.error("Failed to clear mock history: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to clear mock history: " + e.getMessage()));
        }
    }

    @Data
    public static class MockAttemptSubmissionDTO {
        private String startedAt;
        private String submittedAt;
        private int timeTakenSeconds;
        private int totalQuestions;
        private int correctCount;
        private int incorrectCount;
        private int skippedCount;
        private double score;
        private double negativeWastage;
        private Boolean autoSubmitted;
        private String mode;
        private List<MockAttemptAnswerDTO> answers;
    }

    @Data
    public static class MockAttemptAnswerDTO {
        private Long questionId;
        private String selectedAnswer;
        private Boolean isCorrect;
        private double marksAwarded;
    }
}
