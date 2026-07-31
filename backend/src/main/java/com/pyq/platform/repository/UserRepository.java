package com.pyq.platform.repository;

import com.pyq.platform.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.username = :identifier OR u.email = :identifier")
    Optional<User> findByUsernameOrEmail(@org.springframework.data.repository.query.Param("identifier") String identifier);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    java.util.List<User> findByIsPremiumTrueAndPremiumExpiresAtBefore(java.time.LocalDateTime now);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.transaction.annotation.Transactional
    @org.springframework.data.jpa.repository.Query("UPDATE User u SET u.lastActiveAt = :lastActiveAt WHERE u.id = :id")
    void updateLastActiveAt(@org.springframework.data.repository.query.Param("id") Long id,
            @org.springframework.data.repository.query.Param("lastActiveAt") java.time.LocalDateTime lastActiveAt);

    @Query("SELECT COUNT(u) FROM User u WHERE u.lastActiveAt >= :since")
    long countActiveUsersSince(@org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

    @Query("SELECT COUNT(u) FROM User u WHERE u.createdAt >= :since")
    long countNewSignupsSince(@org.springframework.data.repository.query.Param("since") java.time.LocalDateTime since);

    @Query("SELECT COUNT(u) FROM User u WHERE u.isPremium = true")
    long countPremiumUsers();
}
