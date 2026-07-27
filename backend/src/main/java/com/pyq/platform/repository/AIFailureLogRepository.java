package com.pyq.platform.repository;

import com.pyq.platform.entity.AIFailureLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AIFailureLogRepository extends JpaRepository<AIFailureLog, Long> {
}
