package com.pyq.platform.repository;

import com.pyq.platform.entity.AiGenerationLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AiGenerationLedgerRepository extends JpaRepository<AiGenerationLedger, Long> {

    Optional<AiGenerationLedger> findBySubjectIdAndTopicIdAndDifficultyAndQuestionType(
            Long subjectId, Long topicId, String difficulty, String questionType);

    @Query("SELECT l FROM AiGenerationLedger l LEFT JOIN FETCH l.subject LEFT JOIN FETCH l.topic ORDER BY l.totalAccepted ASC, l.lastGeneratedAt ASC")
    List<AiGenerationLedger> findAllBalancedPriority();

    @Query("SELECT COALESCE(SUM(l.totalAccepted), 0) FROM AiGenerationLedger l")
    Long countTotalAcceptedQuestions();

    @Query("SELECT COALESCE(SUM(l.totalRejected), 0) FROM AiGenerationLedger l")
    Long countTotalRejectedQuestions();
}
