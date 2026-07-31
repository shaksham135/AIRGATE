package com.pyq.platform.repository;

import com.pyq.platform.entity.DiscussionVote;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface DiscussionVoteRepository extends JpaRepository<DiscussionVote, Long> {
    Optional<DiscussionVote> findByCommentIdAndUserId(Long commentId, Long userId);
    long countByCommentIdAndVoteType(Long commentId, String voteType);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"comment", "user"})
    List<DiscussionVote> findByCommentQuestionId(Long questionId);
}
