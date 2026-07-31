package com.pyq.platform.repository;

import com.pyq.platform.entity.DiscussionComment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DiscussionCommentRepository extends JpaRepository<DiscussionComment, Long> {
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user", "parentComment"})
    List<DiscussionComment> findByQuestionIdAndParentCommentIsNullOrderByCreatedAtAsc(Long questionId);
    List<DiscussionComment> findByParentCommentIdOrderByCreatedAtAsc(Long parentCommentId);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"user", "parentComment"})
    List<DiscussionComment> findByQuestionIdOrderByCreatedAtAsc(Long questionId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM DiscussionComment dc WHERE dc.question.id = :questionId")
    void deleteByQuestionId(@org.springframework.data.repository.query.Param("questionId") Long questionId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("DELETE FROM DiscussionComment dc WHERE dc.question.id IN :questionIds")
    void deleteByQuestionIdIn(@org.springframework.data.repository.query.Param("questionIds") List<Long> questionIds);
}
