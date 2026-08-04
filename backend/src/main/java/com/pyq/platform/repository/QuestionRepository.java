package com.pyq.platform.repository;

import com.pyq.platform.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long>, JpaSpecificationExecutor<Question> {

    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"subject", "topic"})
    @NonNull
    org.springframework.data.domain.Page<Question> findAll(
        @Nullable org.springframework.data.jpa.domain.Specification<Question> spec,
        @NonNull org.springframework.data.domain.Pageable pageable
    );

    @Override
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    @NonNull
    Optional<Question> findById(@NonNull Long id);

    Optional<Question> findByChecksumHash(String checksumHash);
    boolean existsByChecksumHash(String checksumHash);
    boolean existsByChecksumHashAndTopicId(String checksumHash, Long topicId);
    boolean existsByChecksumHashAndSubjectId(String checksumHash, Long subjectId);
    boolean existsByChecksumHashAndYear(String checksumHash, Integer year);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByStatus(String status);
    List<Question> findByPdfSourceName(String pdfSourceName);
    List<Question> findBySubjectIdAndPdfSourceName(Long subjectId, String pdfSourceName);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query(value = "DELETE FROM question_tags WHERE question_id IN (:questionIds)", nativeQuery = true)
    void deleteQuestionTagsIn(@org.springframework.data.repository.query.Param("questionIds") List<Long> questionIds);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM Question q WHERE q.id IN :questionIds")
    void deleteQuestionsBulk(@org.springframework.data.repository.query.Param("questionIds") List<Long> questionIds);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query(value = "UPDATE questions q JOIN topics t ON q.topic_id = t.id SET q.subject_id = t.subject_id WHERE q.topic_id IS NOT NULL AND q.subject_id <> t.subject_id", nativeQuery = true)
    int alignQuestionSubjectsWithTopics();

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findBySubjectIdAndStatus(Long subjectId, String status);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByTopicIdAndStatus(Long topicId, String status);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByTopicIdInAndStatus(List<Long> topicIds, String status);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findTop5ByTopicIdAndStatusAndIdNot(Long topicId, String status, Long excludeId);

    List<Question> findTop50ByTopicIdOrderByIdDesc(Long topicId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByYearAndStatus(Integer year, String status);

    long countByStatus(String status);
    long countByPdfSourceName(String pdfSourceName);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByStatusAndPublishAtBefore(String status, java.time.LocalDateTime time);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT q.year FROM Question q WHERE q.status = 'APPROVED' ORDER BY q.year DESC")
    List<Integer> findDistinctYearsOfApprovedQuestions();

    @org.springframework.data.jpa.repository.Query("SELECT q.id FROM Question q WHERE q.status = 'APPROVED' ORDER BY q.id DESC")
    List<Long> findApprovedQuestionIds();

    // ── Simulator-specific efficient random sampling (DB-side, no heap load) ──

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' AND subject_id = :subjectId ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApprovedBySubject(
        @org.springframework.data.repository.query.Param("subjectId") Long subjectId,
        @org.springframework.data.repository.query.Param("limit") int limit);

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' AND subject_id = :subjectId AND topic_id = :topicId ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApprovedBySubjectAndTopic(
        @org.springframework.data.repository.query.Param("subjectId") Long subjectId,
        @org.springframework.data.repository.query.Param("topicId") Long topicId,
        @org.springframework.data.repository.query.Param("limit") int limit);

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApproved(
        @org.springframework.data.repository.query.Param("limit") int limit);

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' AND year = :year ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApprovedByYear(
        @org.springframework.data.repository.query.Param("year") int year,
        @org.springframework.data.repository.query.Param("limit") int limit);

    long countBySubjectIdAndTopicIdAndDifficultyAndQuestionTypeAndStatus(
        Long subjectId, Long topicId, String difficulty, String questionType, String status);

    /**
     * Bulk count query: Returns [subjectId, topicId, difficulty, questionType, count]
     * for ALL approved questions in ONE DB call — eliminates N+1 in AI generator.
     */
    @org.springframework.data.jpa.repository.Query(
        "SELECT q.subject.id, q.topic.id, q.difficulty, q.questionType, COUNT(q) " +
        "FROM Question q WHERE q.status = 'APPROVED' " +
        "GROUP BY q.subject.id, q.topic.id, q.difficulty, q.questionType")
    List<Object[]> countApprovedGroupedBySlot();
}
