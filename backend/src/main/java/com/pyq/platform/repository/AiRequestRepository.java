package com.pyq.platform.repository;

import com.pyq.platform.entity.AiRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.LocalDateTime;

public interface AiRequestRepository extends JpaRepository<AiRequest, Long> {

    @Query("SELECT COUNT(a) FROM AiRequest a WHERE a.requestedAt >= :since")
    long countRequestsSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(a) FROM AiRequest a WHERE a.user.id = :userId AND a.requestedAt >= :since")
    long countByUserIdAndRequestedAtAfter(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    @Query("SELECT a.topicName, COUNT(a) FROM AiRequest a WHERE a.topicName IS NOT NULL AND a.topicName != '' GROUP BY a.topicName ORDER BY COUNT(a) DESC")
    java.util.List<Object[]> findMostAskedTopics();

    @Query("SELECT a FROM AiRequest a WHERE a.requestedAt >= :since")
    java.util.List<AiRequest> findRequestsSince(@Param("since") LocalDateTime since);

    @Query("SELECT COALESCE(SUM(a.promptTokens + a.completionTokens), 0) FROM AiRequest a WHERE a.requestedAt >= :since")
    long sumTokensSince(@Param("since") LocalDateTime since);
}
