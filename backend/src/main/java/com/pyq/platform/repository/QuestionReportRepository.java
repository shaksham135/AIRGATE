package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface QuestionReportRepository extends JpaRepository<QuestionReport, Long> {
    List<QuestionReport> findByStatusOrderByCreatedAtDesc(String status);
    List<QuestionReport> findAllByOrderByCreatedAtDesc();
    void deleteByQuestionId(Long questionId);
}
