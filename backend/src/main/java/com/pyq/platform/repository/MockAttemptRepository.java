package com.pyq.platform.repository;

import com.pyq.platform.entity.MockAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import java.util.List;

public interface MockAttemptRepository extends JpaRepository<MockAttempt, Long> {
    @EntityGraph(attributePaths = {"answers", "answers.question", "answers.question.subject"})
    List<MockAttempt> findByUserIdOrderBySubmittedAtDesc(Long userId);
    void deleteByUserId(Long userId);
}
