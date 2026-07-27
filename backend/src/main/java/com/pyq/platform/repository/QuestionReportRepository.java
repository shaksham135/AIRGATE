package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionReportRepository extends JpaRepository<QuestionReport, Long> {

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"question", "user", "question.subject", "question.topic"})
    List<QuestionReport> findByStatusOrderByCreatedAtDesc(String status);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"question", "user", "question.subject", "question.topic"})
    List<QuestionReport> findAllByOrderByCreatedAtDesc();

    void deleteByQuestionId(Long questionId);
}
