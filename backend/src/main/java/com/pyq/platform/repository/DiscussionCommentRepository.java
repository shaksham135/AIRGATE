package com.pyq.platform.repository;

import com.pyq.platform.entity.DiscussionComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DiscussionCommentRepository extends JpaRepository<DiscussionComment, Long> {
    List<DiscussionComment> findByQuestionIdAndParentCommentIsNullOrderByCreatedAtAsc(Long questionId);
    List<DiscussionComment> findByParentCommentIdOrderByCreatedAtAsc(Long parentCommentId);
    List<DiscussionComment> findByQuestionIdOrderByCreatedAtAsc(Long questionId);

    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionId(Long questionId);

    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionIdIn(List<Long> questionIds);
}
