package com.pyq.platform.repository;

import com.pyq.platform.entity.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionRepository extends JpaRepository<Question, Long>, JpaSpecificationExecutor<Question> {
    Optional<Question> findByChecksumHash(String checksumHash);
    boolean existsByChecksumHash(String checksumHash);
    boolean existsByChecksumHashAndTopicId(String checksumHash, Long topicId);
    boolean existsByChecksumHashAndSubjectId(String checksumHash, Long subjectId);
    boolean existsByChecksumHashAndYear(String checksumHash, Integer year);
    List<Question> findByStatus(String status);
    List<Question> findByPdfSourceName(String pdfSourceName);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    void deleteByPdfSourceName(String pdfSourceName);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    void deleteBySubjectIdAndPdfSourceName(Long subjectId, String pdfSourceName);

    List<Question> findBySubjectIdAndStatus(Long subjectId, String status);
    List<Question> findByTopicIdAndStatus(Long topicId, String status);
    List<Question> findByYearAndStatus(Integer year, String status);
    long countByStatus(String status);
    List<Question> findByStatusAndPublishAtBefore(String status, java.time.LocalDateTime time);

    @org.springframework.data.jpa.repository.Query("SELECT DISTINCT q.year FROM Question q WHERE q.status = 'APPROVED' ORDER BY q.year DESC")
    List<Integer> findDistinctYearsOfApprovedQuestions();

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
}
