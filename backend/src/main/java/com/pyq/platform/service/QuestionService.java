package com.pyq.platform.service;

import com.pyq.platform.entity.*;
import com.pyq.platform.repository.*;
import jakarta.persistence.criteria.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.scheduling.annotation.Scheduled;
import java.time.LocalDateTime;

import java.security.MessageDigest;
import java.util.*;

@Service
@Slf4j
@Transactional
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;
    private final TagRepository tagRepository;
    private final QuestionRevisionRepository revisionRepository;
    private final QuestionOptionRepository optionRepository;

    public QuestionService(QuestionRepository questionRepository, SubjectRepository subjectRepository,
                           TopicRepository topicRepository, TagRepository tagRepository,
                           QuestionRevisionRepository revisionRepository, QuestionOptionRepository optionRepository) {
        this.questionRepository = questionRepository;
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.tagRepository = tagRepository;
        this.revisionRepository = revisionRepository;
        this.optionRepository = optionRepository;
    }

    @Cacheable(
        value = "questions",
        key = "T(java.util.Objects).hash(#query, #subjectId, #topicId, #year, #questionType, #tagName, #status, #userId, #solvedStatus, #bookmarked, #pageable.pageNumber, #pageable.pageSize)"
    )
    public Page<Question> searchQuestions(String query, Long subjectId, Long topicId, Integer year, String questionType,
            String tagName, String status, Long userId, String solvedStatus, Boolean bookmarked, Pageable pageable) {
        return questionRepository.findAll(new Specification<Question>() {
            @Override
            public Predicate toPredicate(Root<Question> root, CriteriaQuery<?> criteriaQuery, CriteriaBuilder cb) {
                List<Predicate> predicates = new ArrayList<>();

                // Status Filter
                if (status != null) {
                    predicates.add(cb.equal(root.get("status"), status));
                }

                // Exclude AI practice questions from Explorer page (show only real PYQs)
                predicates.add(cb.not(root.get("pdfSourceName").in("AI_NIGHTLY_GENERATOR", "AI_GENERATED")));

                // Text search query
                if (query != null && !query.trim().isEmpty()) {
                    String pattern = "%" + query.trim().toLowerCase() + "%";
                    predicates.add(cb.or(
                            cb.like(cb.lower(root.get("text")), pattern),
                            cb.like(cb.lower(root.get("pdfSourceName")), pattern)
                    ));
                }

                // Subject ID Filter
                if (subjectId != null) {
                    predicates.add(cb.equal(root.get("subject").get("id"), subjectId));
                }

                // Recursive Topic Search
                if (topicId != null) {
                    List<Long> topicIds = getSubtopicIdsRecursive(topicId);
                    predicates.add(root.get("topic").get("id").in(topicIds));
                }

                // Year Filter
                if (year != null) {
                    predicates.add(cb.equal(root.get("year"), year));
                }

                // Question Type Filter
                if (questionType != null) {
                    predicates.add(cb.equal(cb.upper(root.get("questionType")), questionType.toUpperCase()));
                }

                // Tag Filter (Join query)
                if (tagName != null && !tagName.trim().isEmpty()) {
                    Join<Question, Tag> tagJoin = root.join("tags");
                    predicates.add(cb.equal(cb.lower(tagJoin.get("name")), tagName.toLowerCase()));
                }

                // Bookmarked Filter
                if (Boolean.TRUE.equals(bookmarked) && userId != null) {
                    Join<Question, Bookmark> bookmarkJoin = root.join("bookmarks");
                    predicates.add(cb.equal(bookmarkJoin.get("user").get("id"), userId));
                }

                // Solved/Unsolved/Wrong History Filter using Subquery
                if (solvedStatus != null && !solvedStatus.trim().isEmpty() && userId != null) {
                    Subquery<Long> solveSub = criteriaQuery.subquery(Long.class);
                    Root<UserQuestionSolve> solveRoot = solveSub.from(UserQuestionSolve.class);
                    solveSub.select(solveRoot.get("question").get("id"));

                    if ("SOLVED".equalsIgnoreCase(solvedStatus)) {
                        solveSub.where(cb.and(
                                cb.equal(solveRoot.get("user").get("id"), userId),
                                cb.equal(solveRoot.get("isCorrect"), true)
                        ));
                        predicates.add(root.get("id").in(solveSub));
                    } else if ("WRONG".equalsIgnoreCase(solvedStatus)) {
                        solveSub.where(cb.and(
                                cb.equal(solveRoot.get("user").get("id"), userId),
                                cb.equal(solveRoot.get("isCorrect"), false)
                        ));
                        predicates.add(root.get("id").in(solveSub));
                    } else if ("UNSOLVED".equalsIgnoreCase(solvedStatus)) {
                        solveSub.where(cb.equal(solveRoot.get("user").get("id"), userId));
                        predicates.add(cb.not(root.get("id").in(solveSub)));
                    }
                }

                List<Order> orders = new ArrayList<>();
                if (userId != null && ("APPROVED".equalsIgnoreCase(status) || "PUBLISHED".equalsIgnoreCase(status))) {
                    Join<Question, UserQuestionSolve> solveJoin = root.join("userQuestionSolves", JoinType.LEFT);
                    solveJoin.on(cb.equal(solveJoin.get("user").get("id"), userId));

                    Expression<Integer> isSolved = cb.selectCase()
                            .when(cb.isNull(solveJoin.get("id")), 0)
                            .otherwise(1)
                            .as(Integer.class);

                    orders.add(cb.asc(isSolved)); // Unsolved first, solved last
                }

                orders.add(cb.desc(root.get("year")));
                orders.add(cb.asc(root.get("id")));
                criteriaQuery.orderBy(orders);

                return cb.and(predicates.toArray(new Predicate[0]));
            }
        }, pageable);
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

    public Optional<Question> getQuestionById(Long id) {
        return questionRepository.findById(id);
    }

    public String generateChecksum(String text) {
        try {
            // Strip whitespace, lowercase for normalization
            String normalized = text.toLowerCase().replaceAll("\\s+", "");
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(normalized.getBytes("UTF-8"));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception ex) {
            log.error("Failed to generate checksum: {}", ex.getMessage());
            return UUID.randomUUID().toString(); // Fallback to random to avoid block
        }
    }

    @Transactional
    @CacheEvict(value = {"questions", "years"}, allEntries = true)
    public Question createQuestion(Question question, List<String> optionTexts, Set<String> tagNames) {
        // Generate and set unique hash
        String checksum = generateChecksum(question.getText());
        if (questionRepository.existsByChecksumHash(checksum)) {
            throw new IllegalArgumentException("Duplicate question detected via checksum hashing!");
        }
        question.setChecksumHash(checksum);

        // Resolve and map tags
        Set<Tag> tags = new HashSet<>();
        if (tagNames != null) {
            for (String tName : tagNames) {
                String normalizedTag = tName.trim().toLowerCase();
                if (normalizedTag.isEmpty()) continue;
                Tag tag = tagRepository.findByName(normalizedTag)
                        .orElseGet(() -> tagRepository.save(Tag.builder().name(normalizedTag).build()));
                tags.add(tag);
            }
        }
        question.setTags(tags);

        // Save base question
        Question savedQuestion = questionRepository.save(question);

        // Set options
        if (optionTexts != null && !optionTexts.isEmpty()) {
            List<QuestionOption> options = new ArrayList<>();
            for (int i = 0; i < optionTexts.size(); i++) {
                String label = String.valueOf((char) ('A' + i));
                options.add(QuestionOption.builder()
                        .question(savedQuestion)
                        .optionLabel(label)
                        .optionText(optionTexts.get(i))
                        .build());
            }
            optionRepository.saveAll(options);
            savedQuestion.setOptions(options);
        }

        return savedQuestion;
    }

    @Transactional
    @CacheEvict(value = {"questions", "years"}, allEntries = true)
    public Question updateQuestion(Long id, Question updatedData, List<String> optionTexts,
                                   Set<String> tagNames, User editor) {
        Question existing = questionRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Question not found with ID: " + id));

        // Save audit revision log
        if (!existing.getText().equals(updatedData.getText())) {
            revisionRepository.save(QuestionRevision.builder()
                    .question(existing)
                    .oldText(existing.getText())
                    .newText(updatedData.getText())
                    .editedBy(editor)
                    .build());
        }

        // Update fields
        existing.setText(updatedData.getText());
        existing.setQuestionType(updatedData.getQuestionType());
        existing.setMarks(updatedData.getMarks());
        existing.setNegativeMarks(updatedData.getNegativeMarks());
        existing.setYear(updatedData.getYear());
        existing.setSubject(updatedData.getSubject());
        existing.setTopic(updatedData.getTopic());
        existing.setPdfSourceName(updatedData.getPdfSourceName());
        existing.setPdfSourcePath(updatedData.getPdfSourcePath());
        existing.setPdfPageNumber(updatedData.getPdfPageNumber());
        existing.setImagePath(updatedData.getImagePath());
        existing.setStatus(updatedData.getStatus());
        existing.setIsCommunityVerified(updatedData.getIsCommunityVerified());

        // Update Checksum
        existing.setChecksumHash(generateChecksum(existing.getText()));

        // Resolve tags
        Set<Tag> tags = new HashSet<>();
        if (tagNames != null) {
            for (String tName : tagNames) {
                String normalizedTag = tName.trim().toLowerCase();
                if (normalizedTag.isEmpty()) continue;
                Tag tag = tagRepository.findByName(normalizedTag)
                        .orElseGet(() -> tagRepository.save(Tag.builder().name(normalizedTag).build()));
                tags.add(tag);
            }
        }
        existing.setTags(tags);

        // Update Options
        if (optionTexts != null) {
            existing.getOptions().clear();
            for (int i = 0; i < optionTexts.size(); i++) {
                String label = String.valueOf((char) ('A' + i));
                existing.getOptions().add(QuestionOption.builder()
                        .question(existing)
                        .optionLabel(label)
                        .optionText(optionTexts.get(i))
                        .build());
            }
        }

        return questionRepository.save(existing);
    }

    @Transactional
    @CacheEvict(value = {"questions", "years"}, allEntries = true)
    public Question saveQuestion(Question question) {
        return questionRepository.save(question);
    }

    @Transactional
    @CacheEvict(value = {"questions", "years"}, allEntries = true)
    public void deleteQuestion(Long id) {
        questionRepository.deleteById(id);
    }

    public long countQuestionsByStatus(String status) {
        return questionRepository.countByStatus(status);
    }

    public long countAllQuestions() {
        return questionRepository.count();
    }

    @Cacheable(value = "years")
    public List<Integer> getDistinctYears() {
        return questionRepository.findDistinctYearsOfApprovedQuestions();
    }

    @Scheduled(fixedDelay = 60000)
    @Transactional
    @CacheEvict(value = {"questions", "years"}, allEntries = true)
    public void processScheduledPublishing() {
        log.debug("ScheduledPublishing: Scanning for scheduled APPROVED questions ready to be published...");
        List<Question> ready = questionRepository.findByStatusAndPublishAtBefore("APPROVED", LocalDateTime.now());
        if (!ready.isEmpty()) {
            for (Question q : ready) {
                q.setStatus("PUBLISHED");
                questionRepository.save(q);
                log.info("ScheduledPublishing: Question ID {} auto-transitioned from APPROVED to PUBLISHED (publishAt: {})", q.getId(), q.getPublishAt());
            }
        }
    }
}
