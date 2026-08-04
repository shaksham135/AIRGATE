package com.pyq.platform.repository;

import com.pyq.platform.entity.ExplanationVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExplanationVoteRepository extends JpaRepository<ExplanationVote, Long> {
    Optional<ExplanationVote> findByUserIdAndQuestionId(Long userId, Long questionId);
    long countByQuestionIdAndVoteType(Long questionId, ExplanationVote.VoteType voteType);

    @Query("SELECT ev.question.id, ev.voteType, COUNT(ev) FROM ExplanationVote ev WHERE ev.question.id IN :questionIds GROUP BY ev.question.id, ev.voteType")
    List<Object[]> countVotesByQuestionIds(@Param("questionIds") List<Long> questionIds);

    @Modifying
    @Transactional
    @Query("DELETE FROM ExplanationVote ev WHERE ev.question.id = :questionId")
    void deleteByQuestionId(@Param("questionId") Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM ExplanationVote ev WHERE ev.question.id IN :questionIds")
    void deleteByQuestionIdIn(@Param("questionIds") List<Long> questionIds);
}
