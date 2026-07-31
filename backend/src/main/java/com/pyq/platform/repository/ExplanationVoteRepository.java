package com.pyq.platform.repository;

import com.pyq.platform.entity.ExplanationVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ExplanationVoteRepository extends JpaRepository<ExplanationVote, Long> {
    Optional<ExplanationVote> findByUserIdAndQuestionId(Long userId, Long questionId);
    long countByQuestionIdAndVoteType(Long questionId, ExplanationVote.VoteType voteType);

    @org.springframework.data.jpa.repository.Query("SELECT ev.question.id, ev.voteType, COUNT(ev) FROM ExplanationVote ev WHERE ev.question.id IN :questionIds GROUP BY ev.question.id, ev.voteType")
    java.util.List<Object[]> countVotesByQuestionIds(@org.springframework.data.repository.query.Param("questionIds") java.util.List<Long> questionIds);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM ExplanationVote ev WHERE ev.question.id = :questionId")
    void deleteByQuestionId(@org.springframework.data.repository.query.Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM ExplanationVote ev WHERE ev.question.id IN :questionIds")
    void deleteByQuestionIdIn(@org.springframework.data.repository.query.Param("questionIds") java.util.List<Long> questionIds);
}
