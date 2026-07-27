package com.pyq.platform.controller;

import com.pyq.platform.dto.PageDTO;
import com.pyq.platform.dto.QuestionDTO;
import com.pyq.platform.entity.*;
import com.pyq.platform.mapper.QuestionMapper;
import com.pyq.platform.repository.*;
import com.pyq.platform.security.UserDetailsImpl;
import jakarta.persistence.criteria.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/practice")
@RequiredArgsConstructor
@Slf4j
public class PracticeQuestionController {

    private final QuestionRepository questionRepository;
    private final TopicRepository topicRepository;
    private final UserQuestionSolveRepository solveRepository;
    private final SystemSettingsRepository systemSettingsRepository;
    private final QuestionMapper questionMapper;

    /**
     * GET /api/practice/quota
     * Returns today's practice solve quota for current user
     */
    @GetMapping("/quota")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getPracticeQuota(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        boolean isPremium = userDetails != null && userDetails.isPremium();
        LocalDateTime startOfToday = LocalDate.now().atStartOfDay();

        long usedToday = solveRepository.countByUserIdAndSolvedAtAfter(userDetails.getId(), startOfToday);
        int dailyLimit = 30; // Default 30 questions/day for free users

        return ResponseEntity.ok(Map.of(
                "usedToday", usedToday,
                "limitToday", dailyLimit,
                "isPremium", isPremium,
                "remainingToday", isPremium ? 999999 : Math.max(0, dailyLimit - usedToday)
        ));
    }

    /**
     * GET /api/practice/questions
     * Returns ONLY AI-generated conceptual practice questions with Subject, Topic, Difficulty & Type filters.
     */
    @GetMapping("/questions")
    @Transactional(readOnly = true)
    public ResponseEntity<PageDTO<QuestionDTO>> getPracticeQuestions(
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "subjectId", required = false) Long subjectId,
            @RequestParam(name = "topicId", required = false) Long topicId,
            @RequestParam(name = "difficulty", required = false) String difficulty,
            @RequestParam(name = "type", required = false) String questionType,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "id"));

        Page<Question> questionsPage = questionRepository.findAll(new Specification<Question>() {
            @Override
            public Predicate toPredicate(Root<Question> root, CriteriaQuery<?> criteriaQuery, CriteriaBuilder cb) {
                List<Predicate> predicates = new ArrayList<>();

                // Filter ONLY AI Generated Practice Questions
                predicates.add(root.get("pdfSourceName").in("AI_NIGHTLY_GENERATOR", "AI_GENERATED", "AI_GENERATION", "AI_SYSTEM", "CONCEPTUAL_PRACTICE"));
                predicates.add(cb.equal(root.get("status"), "APPROVED"));

                // Subject Filter
                if (subjectId != null) {
                    predicates.add(cb.equal(root.get("subject").get("id"), subjectId));
                }

                // Topic Filter
                if (topicId != null) {
                    List<Long> topicIds = getSubtopicIdsRecursive(topicId);
                    predicates.add(root.get("topic").get("id").in(topicIds));
                }

                // Difficulty Filter (EASY / MEDIUM / HARD)
                if (difficulty != null && !difficulty.isBlank() && !"ALL".equalsIgnoreCase(difficulty)) {
                    predicates.add(cb.equal(cb.upper(root.get("difficulty")), difficulty.toUpperCase()));
                }

                // Question Type Filter (MCQ / MSQ / NAT)
                if (questionType != null && !questionType.isBlank() && !"ALL".equalsIgnoreCase(questionType)) {
                    predicates.add(cb.equal(cb.upper(root.get("questionType")), questionType.toUpperCase()));
                }

                // Search query
                if (query != null && !query.trim().isEmpty()) {
                    String pattern = "%" + query.trim().toLowerCase() + "%";
                    predicates.add(cb.like(cb.lower(root.get("text")), pattern));
                }

                return cb.and(predicates.toArray(new Predicate[0]));
            }
        }, pageable);

        List<QuestionDTO> dtos = questionsPage.getContent().stream()
                .map(questionMapper::convertToDTOFast)
                .collect(Collectors.toList());

        PageDTO<QuestionDTO> pageDTO = PageDTO.<QuestionDTO>builder()
                .content(dtos)
                .pageNumber(questionsPage.getNumber())
                .pageSize(questionsPage.getSize())
                .totalElements(questionsPage.getTotalElements())
                .totalPages(questionsPage.getTotalPages())
                .build();

        return ResponseEntity.ok(pageDTO);
    }

    private List<Long> getSubtopicIdsRecursive(Long topicId) {
        List<Long> ids = new ArrayList<>();
        ids.add(topicId);
        List<Topic> children = topicRepository.findByParentTopicId(topicId);
        for (Topic child : children) {
            ids.addAll(getSubtopicIdsRecursive(child.getId()));
        }
        return ids;
    }
}
