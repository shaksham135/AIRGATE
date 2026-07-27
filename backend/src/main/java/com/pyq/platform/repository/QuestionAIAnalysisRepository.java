package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionAIAnalysis;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface QuestionAIAnalysisRepository extends JpaRepository<QuestionAIAnalysis, Long> {
    Optional<QuestionAIAnalysis> findFirstByQuestionIdOrderByCreatedAtDesc(Long questionId);
    java.util.List<QuestionAIAnalysis> findByQuestionId(Long questionId);
    java.util.List<QuestionAIAnalysis> findByModelNameIn(java.util.List<String> modelNames);
    long countByModelName(String modelName);
    Optional<QuestionAIAnalysis> findFirstByModelNameOrderByIdAsc(String modelName);

    @org.springframework.data.jpa.repository.Query("SELECT qaa FROM QuestionAIAnalysis qaa WHERE qaa.modelName = :modelName AND qaa.question.status = 'APPROVED' ORDER BY qaa.id ASC")
    java.util.List<QuestionAIAnalysis> findPendingApprovedByModelName(String modelName, org.springframework.data.domain.Pageable pageable);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(qaa) FROM QuestionAIAnalysis qaa WHERE qaa.modelName = :modelName AND qaa.question.status = 'APPROVED'")
    long countPendingApprovedByModelName(String modelName);




}
