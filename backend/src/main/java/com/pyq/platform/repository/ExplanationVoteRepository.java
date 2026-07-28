package com.pyq.platform.repository;

import com.pyq.platform.entity.ExplanationVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface ExplanationVoteRepository extends JpaRepository<ExplanationVote, Long> {
    Optional<ExplanationVote> findByUserIdAndQuestionId(Long userId, Long questionId);
    long countByQuestionIdAndVoteType(Long questionId, ExplanationVote.VoteType voteType);

    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionId(Long questionId);

    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionIdIn(java.util.List<Long> questionIds);
}
