package com.pyq.platform.repository;

import com.pyq.platform.entity.QuestionAIAnalysis;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionAIAnalysisRepository extends JpaRepository<QuestionAIAnalysis, Long> {
    Optional<QuestionAIAnalysis> findFirstByQuestionIdOrderByCreatedAtDesc(Long questionId);
    List<QuestionAIAnalysis> findByQuestionId(Long questionId);
    List<QuestionAIAnalysis> findByModelNameIn(List<String> modelNames);
    long countByModelName(String modelName);
    Optional<QuestionAIAnalysis> findFirstByModelNameOrderByIdAsc(String modelName);

    @EntityGraph(attributePaths = {"question", "question.options"})
    @Query("SELECT qaa FROM QuestionAIAnalysis qaa WHERE qaa.modelName = :modelName AND qaa.question.status = 'APPROVED' ORDER BY qaa.id ASC")
    List<QuestionAIAnalysis> findPendingApprovedByModelName(String modelName, Pageable pageable);

    @Query("SELECT COUNT(qaa) FROM QuestionAIAnalysis qaa WHERE qaa.modelName = :modelName AND qaa.question.status = 'APPROVED'")
    long countPendingApprovedByModelName(String modelName);

    @Modifying
    @Transactional
    @Query("DELETE FROM QuestionAIAnalysis qaa WHERE qaa.question.id = :questionId")
    void deleteByQuestionId(@Param("questionId") Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM QuestionAIAnalysis qaa WHERE qaa.question.id IN :questionIds")
    void deleteByQuestionIdIn(@Param("questionIds") List<Long> questionIds);
}
