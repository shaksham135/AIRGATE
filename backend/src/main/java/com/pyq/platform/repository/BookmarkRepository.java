package com.pyq.platform.repository;

import com.pyq.platform.entity.Bookmark;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface BookmarkRepository extends JpaRepository<Bookmark, Long> {

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"question", "question.options", "question.subject", "question.topic"})
    List<Bookmark> findByUserId(Long userId);

    Optional<Bookmark> findByUserIdAndQuestionId(Long userId, Long questionId);
    boolean existsByUserIdAndQuestionId(Long userId, Long questionId);
    void deleteByUserIdAndQuestionId(Long userId, Long questionId);
    
    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionId(Long questionId);

    @org.springframework.transaction.annotation.Transactional
    void deleteByQuestionIdIn(List<Long> questionIds);

    long countByUserId(Long userId);
}
