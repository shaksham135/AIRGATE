package com.pyq.platform.repository;

import com.pyq.platform.entity.UserAnswer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface UserAnswerRepository extends JpaRepository<UserAnswer, Long> {
    
    List<UserAnswer> findByQuestionId(Long questionId);

    @Query("SELECT ua FROM UserAnswer ua WHERE ua.question.id = :questionId")
    List<UserAnswer> findAnswersByQuestionId(@Param("questionId") Long questionId);

    // Dynamic community sorting query
    @Query("SELECT ua, " +
           "  SUM(CASE WHEN av.voteType = 'UPVOTE' THEN 1 WHEN av.voteType = 'DOWNVOTE' THEN -1 ELSE 0 END) as score " +
           "FROM UserAnswer ua " +
           "LEFT JOIN AnswerVote av ON av.userAnswer = ua " +
           "WHERE ua.question.id = :questionId " +
           "GROUP BY ua.id " +
           "ORDER BY score DESC")
    List<Object[]> findAnswersWithScoresByQuestionId(@Param("questionId") Long questionId);
}
