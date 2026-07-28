package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionReportRepository extends JpaRepository<QuestionReport, Long> {

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"question", "reportedBy", "question.subject", "question.topic"})
    List<QuestionReport> findByStatusOrderByCreatedAtDesc(String status);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"question", "reportedBy", "question.subject", "question.topic"})
    List<QuestionReport> findAllByOrderByCreatedAtDesc();

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM QuestionReport qr WHERE qr.question.id = :questionId")
    void deleteByQuestionId(@org.springframework.data.repository.query.Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM QuestionReport qr WHERE qr.question.id IN :questionIds")
    void deleteByQuestionIdIn(@org.springframework.data.repository.query.Param("questionIds") List<Long> questionIds);
}
