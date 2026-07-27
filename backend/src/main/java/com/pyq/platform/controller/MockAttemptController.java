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
    public ResponseEntity<?> submitMockAttempt(
            @RequestBody MockAttemptSubmissionDTO dto,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        try {
            User user = userRepository.findById(userDetails.getId()).orElseThrow();

            LocalDateTime start = LocalDateTime.parse(dto.getStartedAt(), DateTimeFormatter.ISO_DATE_TIME);
            LocalDateTime end = LocalDateTime.parse(dto.getSubmittedAt(), DateTimeFormatter.ISO_DATE_TIME);

            MockAttempt attempt = MockAttempt.builder()
                    .user(user)
                    .startedAt(start)
                    .submittedAt(end)
                    .timeTakenSeconds(dto.getTimeTakenSeconds())
                    .totalQuestions(dto.getTotalQuestions())
                    .correctCount(dto.getCorrectCount())
                    .incorrectCount(dto.getIncorrectCount())
                    .skippedCount(dto.getSkippedCount())
                    .score(dto.getScore())
                    .negativeWastage(dto.getNegativeWastage())
                    .autoSubmitted(dto.getAutoSubmitted())
                    .mode(dto.getMode())
                    .build();

            List<MockAttemptAnswer> attemptAnswers = new ArrayList<>();
            if (dto.getAnswers() != null) {
                for (MockAttemptAnswerDTO ansDto : dto.getAnswers()) {
                    Question q = questionRepository.findById(ansDto.getQuestionId()).orElse(null);
                    if (q != null) {
                        MockAttemptAnswer ans = MockAttemptAnswer.builder()
                                .attempt(attempt)
                                .question(q)
                                .selectedAnswer(ansDto.getSelectedAnswer())
                                .isCorrect(ansDto.getIsCorrect())
                                .marksAwarded(ansDto.getMarksAwarded())
                                .build();
                        attemptAnswers.add(ans);
                    }
                }
            }

            attempt.setAnswers(attemptAnswers);
            mockAttemptRepository.save(attempt);

            return ResponseEntity.ok(Map.of("success", true, "attemptId", attempt.getId()));
        } catch (Exception e) {
            log.error("Failed to submit mock attempt: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to save mock attempt: " + e.getMessage()));
        }
    }

    @GetMapping("/history")
    @PreAuthorize("isAuthenticated()")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
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
