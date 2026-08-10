package com.pyq.platform.repository;

import com.pyq.platform.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    @Query("SELECT u FROM User u WHERE u.username = :identifier OR u.email = :identifier")
    Optional<User> findByUsernameOrEmail(@Param("identifier") String identifier);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    List<User> findByIsPremiumTrueAndPremiumExpiresAtBefore(LocalDateTime now);

    List<User> findByRole(User.UserRole role);

    @Modifying
    @Transactional
    @Query("UPDATE User u SET u.lastActiveAt = :lastActiveAt WHERE u.id = :id")
    void updateLastActiveAt(@Param("id") Long id,
            @Param("lastActiveAt") LocalDateTime lastActiveAt);

    @Query("SELECT COUNT(u) FROM User u WHERE u.lastActiveAt >= :since")
    long countActiveUsersSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(u) FROM User u WHERE u.createdAt >= :since")
    long countNewSignupsSince(@Param("since") LocalDateTime since);

    @Query("SELECT COUNT(u) FROM User u WHERE u.isPremium = true")
    long countPremiumUsers();
}
