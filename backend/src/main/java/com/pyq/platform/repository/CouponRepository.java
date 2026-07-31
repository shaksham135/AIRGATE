package com.pyq.platform.repository;

import com.pyq.platform.entity.Coupon;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CouponRepository extends JpaRepository<Coupon, Long> {

    Optional<Coupon> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    List<Coupon> findByActiveTrueOrderByCreatedAtDesc();

    List<Coupon> findAllByOrderByCreatedAtDesc();

    @Modifying
    @Query("UPDATE Coupon c SET c.currentUses = c.currentUses + 1 WHERE c.id = :couponId AND c.currentUses < c.maxUses")
    int incrementCurrentUses(@Param("couponId") Long couponId);
}
