package com.pyq.platform.repository;

import com.pyq.platform.entity.UserQuestionSolve;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserQuestionSolveRepository extends JpaRepository<UserQuestionSolve, Long> {

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"question", "question.options", "question.subject", "question.topic"})
    List<UserQuestionSolve> findByUserId(Long userId);

    Optional<UserQuestionSolve> findByUserIdAndQuestionId(Long userId, Long questionId);
    long countByUserId(Long userId);
    long countByUserIdAndIsCorrect(Long userId, Boolean isCorrect);

    @org.springframework.transaction.annotation.Transactional
    void deleteByUserId(Long userId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM UserQuestionSolve u WHERE u.question.id = :questionId")
    void deleteByQuestionId(@org.springframework.data.repository.query.Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM UserQuestionSolve u WHERE u.question.id IN :questionIds")
    void deleteByQuestionIdIn(@org.springframework.data.repository.query.Param("questionIds") List<Long> questionIds);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(u) FROM UserQuestionSolve u WHERE u.solvedAt >= :since")
    long countSolvesSince(@org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(u) FROM UserQuestionSolve u WHERE u.user.id = :userId AND u.solvedAt >= :since")
    long countByUserIdAndSolvedAtAfter(
        @org.springframework.data.repository.query.Param("userId") Long userId,
        @org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

    @org.springframework.data.jpa.repository.Query("SELECT s.name, COUNT(u), SUM(CASE WHEN u.isCorrect = true THEN 1.0 ELSE 0.0 END) / COUNT(u) * 100.0 FROM UserQuestionSolve u JOIN u.question q JOIN q.subject s WHERE u.user.id = :userId GROUP BY s.name")
    java.util.List<Object[]> findSubjectAccuracyForUser(
        @org.springframework.data.repository.query.Param("userId") Long userId);

    @org.springframework.data.jpa.repository.Query(
        value = "SELECT DATE(solved_at) as day, COUNT(*) FROM user_question_solves WHERE user_id = :userId AND solved_at >= :since GROUP BY DATE(solved_at)",
        nativeQuery = true)
    java.util.List<Object[]> findDailyCountForUser(
        @org.springframework.data.repository.query.Param("userId") Long userId,
        @org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

    @org.springframework.data.jpa.repository.Query("SELECT s.name, COUNT(u) FROM UserQuestionSolve u JOIN u.question q JOIN q.subject s GROUP BY s.name ORDER BY COUNT(u) DESC")
    java.util.List<Object[]> findPopularSubjects();

    @org.springframework.data.jpa.repository.Query("SELECT COUNT(DISTINCT u.user.id) FROM UserQuestionSolve u")
    long countDistinctUsersWithSolves();
}

