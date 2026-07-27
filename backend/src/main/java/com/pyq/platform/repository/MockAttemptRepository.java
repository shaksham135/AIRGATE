package com.pyq.platform.repository;

import com.pyq.platform.entity.MockAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MockAttemptRepository extends JpaRepository<MockAttempt, Long> {
    List<MockAttempt> findByUserIdOrderBySubmittedAtDesc(Long userId);
    void deleteByUserId(Long userId);
}
