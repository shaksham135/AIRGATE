package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionReport;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface QuestionReportRepository extends JpaRepository<QuestionReport, Long> {

    @EntityGraph(attributePaths = {"question", "reportedBy", "question.subject", "question.topic"})
    List<QuestionReport> findByStatusOrderByCreatedAtDesc(String status);

    @EntityGraph(attributePaths = {"question", "reportedBy", "question.subject", "question.topic"})
    List<QuestionReport> findAllByOrderByCreatedAtDesc();

    @Modifying
    @Transactional
    @Query("DELETE FROM QuestionReport qr WHERE qr.question.id = :questionId")
    void deleteByQuestionId(@Param("questionId") Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM QuestionReport qr WHERE qr.question.id IN :questionIds")
    void deleteByQuestionIdIn(@Param("questionIds") List<Long> questionIds);
}
