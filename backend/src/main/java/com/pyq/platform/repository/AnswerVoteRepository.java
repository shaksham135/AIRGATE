package com.pyq.platform.repository;

import com.pyq.platform.entity.AnswerVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface AnswerVoteRepository extends JpaRepository<AnswerVote, Long> {
    Optional<AnswerVote> findByUserAnswerIdAndUserId(Long userAnswerId, Long userId);
    long countByUserAnswerIdAndVoteType(Long userAnswerId, String voteType);
    long countByUserAnswerId(Long userAnswerId);
}
