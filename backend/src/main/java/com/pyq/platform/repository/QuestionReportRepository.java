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

    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionId(Long questionId);

    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionIdIn(List<Long> questionIds);
}
