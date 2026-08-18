package com.pyq.platform.repository;

import com.pyq.platform.entity.MockAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;

public interface MockAttemptRepository extends JpaRepository<MockAttempt, Long> {
    @EntityGraph(attributePaths = {"answers", "answers.question", "answers.question.subject"})
    List<MockAttempt> findByUserIdOrderBySubmittedAtDesc(Long userId);
    void deleteByUserId(Long userId);
    long countByUserIdAndMode(Long userId, String mode);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(ma) FROM MockAttempt ma WHERE ma.totalQuestions >= 20")
    long countFullMockAttempts();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(ma) FROM MockAttempt ma WHERE ma.totalQuestions >= 20 AND ma.score <= :score")
    long countFullMockAttemptsWithScoreLessThanOrEqual(@org.springframework.data.repository.query.Param("score") Double score);
}
