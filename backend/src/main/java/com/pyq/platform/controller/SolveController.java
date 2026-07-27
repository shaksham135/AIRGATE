package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.dto.QuestionDTO;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.*;
import com.pyq.platform.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;
import lombok.extern.slf4j.Slf4j;

import java.util.*;

@RestController
@RequestMapping("/api")
@Transactional
@Slf4j
public class SolveController {

    private final UserQuestionSolveRepository userQuestionSolveRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;
    private final BookmarkRepository bookmarkRepository;
    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final com.pyq.platform.mapper.QuestionMapper questionMapper;

    public SolveController(UserQuestionSolveRepository userQuestionSolveRepository,
            QuestionRepository questionRepository,
            UserRepository userRepository,
            BookmarkRepository bookmarkRepository,
            QuestionAIAnalysisRepository aiAnalysisRepository,
            com.pyq.platform.mapper.QuestionMapper questionMapper) {
        this.userQuestionSolveRepository = userQuestionSolveRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
        this.bookmarkRepository = bookmarkRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.questionMapper = questionMapper;
    }

    // Solve question and record result
    @PostMapping("/questions/{id}/solve")
    @PreAuthorize("isAuthenticated()")
    @org.springframework.cache.annotation.Caching(evict = {
        @CacheEvict(value = "questions", allEntries = true),
        @CacheEvict(value = "userSolveStats", key = "#userDetails.id")
    })
    public ResponseEntity<?> solveQuestion(
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        String selectedOption = payload.get("selectedOption");
        if (selectedOption == null || selectedOption.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: selectedOption is required!"));
        }

        User user = userRepository.findById(userDetails.getId()).orElseThrow();
        Question question = questionOpt.get();

        // ── Daily Quota Check for AI Practice Questions ─────────────────────────────
        boolean isAiPracticeQ = "AI_NIGHTLY_GENERATOR".equalsIgnoreCase(question.getPdfSourceName()) ||
                "AI_GENERATED".equalsIgnoreCase(question.getPdfSourceName());
        boolean isPremium = Boolean.TRUE.equals(user.getIsPremium());

        if (isAiPracticeQ && !isPremium) {
            java.time.LocalDateTime startOfToday = java.time.LocalDate.now().atStartOfDay();
            long usedToday = userQuestionSolveRepository.countByUserIdAndSolvedAtAfter(user.getId(), startOfToday);
            if (usedToday >= 30) {
                log.warn("Daily practice limit (30 Qs) reached for user: {}", user.getUsername());
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                        .body(Map.of("error", "QUOTA_EXCEEDED", "message",
                                "You have reached your daily quota of 30 practice questions! Upgrade to Aspirant Pro for unlimited daily conceptual practice."));
            }
        }
        // ────────────────────────────────────────────────────────────────────────────

        // Get AI Suggested correct answer to compare
        Optional<QuestionAIAnalysis> aiAnalysis = aiAnalysisRepository.findFirstByQuestionIdOrderByCreatedAtDesc(id);
        String correctAnswer = aiAnalysis.map(QuestionAIAnalysis::getSuggestedAnswer).orElse("");

        boolean isCorrect = checkAnswer(correctAnswer, selectedOption);

        Optional<UserQuestionSolve> existingOpt = userQuestionSolveRepository.findByUserIdAndQuestionId(user.getId(),
                id);
        if (existingOpt.isPresent()) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Question answer is already locked and cannot be changed!"));
        }

        String timeTakenStr = payload.get("timeTaken");
        Integer timeTaken = null;
        if (timeTakenStr != null && !timeTakenStr.trim().isEmpty()) {
            try {
                timeTaken = Integer.parseInt(timeTakenStr.trim());
            } catch (NumberFormatException e) {
                // ignore
            }
        }

        UserQuestionSolve solve = UserQuestionSolve.builder()
                .user(user)
                .question(question)
                .selectedOption(selectedOption)
                .isCorrect(isCorrect)
                .solvingTimeSeconds(timeTaken)
                .build();

        userQuestionSolveRepository.save(solve);

        // Calculate and update user streak
        try {
            java.time.LocalDate today = java.time.LocalDate.now();
            java.time.LocalDate lastSolved = user.getLastSolvedDate();

            if (lastSolved == null) {
                user.setCurrentStreak(1);
                user.setLongestStreak(1);
                user.setLastSolvedDate(today);
            } else if (!lastSolved.equals(today)) {
                if (lastSolved.equals(today.minusDays(1))) {
                    int nextStreak = user.getCurrentStreak() + 1;
                    user.setCurrentStreak(nextStreak);
                    if (nextStreak > user.getLongestStreak()) {
                        user.setLongestStreak(nextStreak);
                    }
                } else {
                    user.setCurrentStreak(1);
                }
                user.setLastSolvedDate(today);
            }
            userRepository.save(user);
        } catch (Exception ex) {
            log.warn("Failed to update streak for user ID {}: {}", user.getId(), ex.getMessage());
        }

        Map<String, Object> response = new HashMap<>();
        response.put("isCorrect", isCorrect);
        response.put("correctAnswer", correctAnswer);
        response.put("message", "Answer logged successfully!");
        return ResponseEntity.ok(response);
    }

    // Get solve stats
    @GetMapping("/questions/solve/stats")
    @PreAuthorize("isAuthenticated()")
    @org.springframework.cache.annotation.Cacheable(value = "userSolveStats", key = "#userDetails.id")
    public ResponseEntity<?> getStats(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        Long userId = userDetails.getId();
        long totalSolved = userQuestionSolveRepository.countByUserId(userId);
        long correctCount = userQuestionSolveRepository.countByUserIdAndIsCorrect(userId, true);
        long incorrectCount = totalSolved - correctCount;
        long bookmarkedCount = bookmarkRepository.countByUserId(userId);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalSolved", totalSolved);
        stats.put("correctCount", correctCount);
        stats.put("incorrectCount", incorrectCount);
        stats.put("bookmarkedCount", bookmarkedCount);

        double accuracy = totalSolved > 0 ? ((double) correctCount / totalSolved) * 100 : 0.0;
        stats.put("accuracy", Math.round(accuracy * 10.0) / 10.0); // round to 1 decimal place

        return ResponseEntity.ok(stats);
    }

    // List solved history
    @GetMapping("/questions/solved")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getSolvedQuestions(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        List<UserQuestionSolve> solves = userQuestionSolveRepository.findByUserId(userDetails.getId());
        List<Map<String, Object>> result = new ArrayList<>();

        for (UserQuestionSolve solve : solves) {
            Map<String, Object> map = new HashMap<>();
            map.put("id", solve.getId());
            map.put("selectedOption", solve.getSelectedOption());
            map.put("isCorrect", solve.getIsCorrect());
            map.put("solvedAt", solve.getSolvedAt());
            map.put("solvingTimeSeconds", solve.getSolvingTimeSeconds());
            map.put("question", convertToDTO(solve.getQuestion()));
            result.add(map);
        }

        return ResponseEntity.ok(result);
    }

    private QuestionDTO convertToDTO(Question question) {
        return questionMapper.convertToDTOFast(question);
    }

    private static String normalizeMsq(String val) {
        if (val == null)
            return "";
        String clean = val.trim().toLowerCase().replaceAll("(?i)^option\\s+", "");
        String[] tokens = clean.split("[,;\\s\\-\\+]+");
        List<String> list = new ArrayList<>();
        for (String t : tokens) {
            String trimmed = t.trim();
            if (!trimmed.isEmpty()) {
                list.add(trimmed);
            }
        }
        Collections.sort(list);
        return String.join("", list);
    }

    private static boolean checkAnswer(String correct, String selected) {
        if (correct == null || selected == null)
            return false;

        String normCorrect = normalizeMsq(correct);
        String normSelected = normalizeMsq(selected);
        if (!normCorrect.isEmpty() && normCorrect.equals(normSelected)) {
            return true;
        }

        String c = correct.trim().toLowerCase().replaceAll("(?i)^option\\s+", "");
        String s = selected.trim().toLowerCase().replaceAll("(?i)^option\\s+", "");

        // Try parsing as double
        try {
            double sVal = Double.parseDouble(s);

            // Check if correct is a range, e.g. "10-12", "10 to 12", "10:12"
            String rangePattern = "[-:to]+";
            String[] parts = c.split(rangePattern);
            if (parts.length == 2) {
                double min = Double.parseDouble(parts[0].trim());
                double max = Double.parseDouble(parts[1].trim());
                return sVal >= min && sVal <= max;
            } else if (parts.length == 1) {
                double cVal = Double.parseDouble(c);
                return Math.abs(cVal - sVal) < 1e-4; // float tolerance
            }
        } catch (NumberFormatException e) {
            // fallback
        }
        return false;
    }

    // Reset solved history for a user
    @DeleteMapping("/questions/solve/reset")
    @PreAuthorize("isAuthenticated()")
    @CacheEvict(value = "questions", allEntries = true)
    public ResponseEntity<?> resetSolvedHistory(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        userQuestionSolveRepository.deleteByUserId(userDetails.getId());
        return ResponseEntity.ok(new MessageResponse("Solved history reset successfully!"));
    }
}
