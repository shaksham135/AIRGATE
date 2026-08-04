package com.pyq.platform.repository;

import com.pyq.platform.entity.DiscussionComment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface DiscussionCommentRepository extends JpaRepository<DiscussionComment, Long> {
    @EntityGraph(attributePaths = {"user", "parentComment"})
    List<DiscussionComment> findByQuestionIdAndParentCommentIsNullOrderByCreatedAtAsc(Long questionId);
    List<DiscussionComment> findByParentCommentIdOrderByCreatedAtAsc(Long parentCommentId);
    @EntityGraph(attributePaths = {"user", "parentComment"})
    List<DiscussionComment> findByQuestionIdOrderByCreatedAtAsc(Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM DiscussionComment dc WHERE dc.question.id = :questionId")
    void deleteByQuestionId(@Param("questionId") Long questionId);

    @Modifying
    @Transactional
    @Query("DELETE FROM DiscussionComment dc WHERE dc.question.id IN :questionIds")
    void deleteByQuestionIdIn(@Param("questionIds") List<Long> questionIds);
}
