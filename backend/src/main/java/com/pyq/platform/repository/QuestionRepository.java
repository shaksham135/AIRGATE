package com.pyq.platform.repository;

import com.pyq.platform.entity.Question;
import com.pyq.platform.entity.Subject;
import com.pyq.platform.entity.Topic;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.lang.NonNull;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long>, JpaSpecificationExecutor<Question> {

    @Override
    @EntityGraph(attributePaths = {"subject", "topic"})
    @NonNull
    Page<Question> findAll(
        @Nullable Specification<Question> spec,
        @NonNull Pageable pageable
    );

    @Override
    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    @NonNull
    Optional<Question> findById(@NonNull Long id);

    Optional<Question> findByChecksumHash(String checksumHash);
    boolean existsByChecksumHash(String checksumHash);
    boolean existsByChecksumHashAndTopicId(String checksumHash, Long topicId);
    boolean existsByChecksumHashAndSubjectId(String checksumHash, Long subjectId);
    boolean existsByChecksumHashAndYear(String checksumHash, Integer year);

    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByStatus(String status);
    List<Question> findByPdfSourceName(String pdfSourceName);
    List<Question> findBySubjectIdAndPdfSourceName(Long subjectId, String pdfSourceName);

    @Modifying
    @Transactional
    @Query(value = "DELETE FROM question_tags WHERE question_id IN (:questionIds)", nativeQuery = true)
    void deleteQuestionTagsIn(@Param("questionIds") List<Long> questionIds);

    @Modifying
    @Transactional
    @Query("DELETE FROM Question q WHERE q.id IN :questionIds")
    void deleteQuestionsBulk(@Param("questionIds") List<Long> questionIds);


    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findBySubjectIdAndStatus(Long subjectId, String status);

    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByTopicIdAndStatus(Long topicId, String status);

    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByTopicIdInAndStatus(List<Long> topicIds, String status);

    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findTop5ByTopicIdAndStatusAndIdNot(Long topicId, String status, Long excludeId);

    List<Question> findTop50ByTopicIdOrderByIdDesc(Long topicId);

    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByYearAndStatus(Integer year, String status);

    long countByStatus(String status);
    long countByPdfSourceName(String pdfSourceName);

    @EntityGraph(attributePaths = {"options", "subject", "topic"})
    List<Question> findByStatusAndPublishAtBefore(String status, java.time.LocalDateTime time);

    @Query("SELECT COUNT(q) FROM Question q WHERE q.status = :status AND (q.pdfSourceName IS NULL OR (q.pdfSourceName NOT LIKE 'AI_GENERATED%' AND q.pdfSourceName NOT LIKE '%AI Generator%' AND q.pdfSourceName NOT LIKE '%PRACTICE%'))")
    long countOfficialPyqsByStatus(@Param("status") String status);

    @Query("SELECT COUNT(q) FROM Question q WHERE q.pdfSourceName IS NULL OR (q.pdfSourceName NOT LIKE 'AI_GENERATED%' AND q.pdfSourceName NOT LIKE '%AI Generator%' AND q.pdfSourceName NOT LIKE '%PRACTICE%')")
    long countOfficialPyqsTotal();

    @Query("SELECT q FROM Question q WHERE q.pdfSourceName LIKE 'AI_NIGHTLY%' OR q.pdfSourceName LIKE 'AI_GENERATED%' OR q.pdfSourceName LIKE '%AI Generator%' OR q.pdfSourceName LIKE '%PRACTICE%'")
    List<Question> findAllAiGeneratedQuestions();

    @Query("SELECT q.subject.name, COUNT(q), " +
           "SUM(CASE WHEN q.status IN ('PENDING_REVIEW', 'PENDING') THEN 1 ELSE 0 END), " +
           "SUM(CASE WHEN q.status = 'APPROVED' OR q.isCommunityVerified = true THEN 1 ELSE 0 END) " +
           "FROM Question q " +
           "WHERE q.pdfSourceName LIKE 'AI_NIGHTLY%' OR q.pdfSourceName LIKE 'AI_GENERATED%' OR q.pdfSourceName LIKE '%AI Generator%' OR q.pdfSourceName LIKE '%PRACTICE%' " +
           "GROUP BY q.subject.name")
    List<Object[]> getAiQuestionSubjectSummaries();

    @Query("SELECT DISTINCT q.year FROM Question q WHERE q.status = 'APPROVED' ORDER BY q.year DESC")
    List<Integer> findDistinctYearsOfApprovedQuestions();

    @Query("SELECT q.id FROM Question q WHERE q.status = 'APPROVED' ORDER BY q.id DESC")
    List<Long> findApprovedQuestionIds();

    // ── Simulator-specific efficient random sampling (DB-side, no heap load) ──

    @Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' AND subject_id = :subjectId ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApprovedBySubject(
        @Param("subjectId") Long subjectId,
        @Param("limit") int limit);

    @Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' AND subject_id = :subjectId AND topic_id = :topicId ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApprovedBySubjectAndTopic(
        @Param("subjectId") Long subjectId,
        @Param("topicId") Long topicId,
        @Param("limit") int limit);

    @Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApproved(
        @Param("limit") int limit);

    @Query(
        value = "SELECT * FROM questions WHERE status = 'APPROVED' AND year = :year ORDER BY RAND() LIMIT :limit",
        nativeQuery = true)
    List<Question> findRandomApprovedByYear(
        @Param("year") int year,
        @Param("limit") int limit);

    long countBySubjectIdAndTopicIdAndDifficultyAndQuestionTypeAndStatus(
        Long subjectId, Long topicId, String difficulty, String questionType, String status);

    /**
     * Bulk count query: Returns [subjectId, topicId, difficulty, questionType, count]
     * for ALL approved questions in ONE DB call — eliminates N+1 in AI generator.
     */
    @Query(
        "SELECT q.subject.id, q.topic.id, q.difficulty, q.questionType, COUNT(q) " +
        "FROM Question q WHERE q.status = 'APPROVED' " +
        "GROUP BY q.subject.id, q.topic.id, q.difficulty, q.questionType")
    List<Object[]> countApprovedGroupedBySlot();

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query("UPDATE Question q SET q.topic = :newTopic, q.subject = :newSubject WHERE q.topic.id = :oldTopicId")
    int relinkQuestionsToTopic(
        @Param("oldTopicId") Long oldTopicId,
        @Param("newTopic") Topic newTopic,
        @Param("newSubject") Subject newSubject);

    @Modifying(clearAutomatically = true)
    @Transactional
    @Query(
        value = "UPDATE questions q JOIN topics t ON q.topic_id = t.id SET q.subject_id = t.subject_id WHERE q.subject_id <> t.subject_id",
        nativeQuery = true)
    int alignQuestionSubjectsWithTopics();
}
