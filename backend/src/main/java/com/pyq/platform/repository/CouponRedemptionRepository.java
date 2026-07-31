package com.pyq.platform.repository;

import com.pyq.platform.entity.CouponRedemption;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CouponRedemptionRepository extends JpaRepository<CouponRedemption, Long> {

    long countByUserIdAndCouponId(Long userId, Long couponId);

    List<CouponRedemption> findByUserId(Long userId);

    List<CouponRedemption> findByCouponId(Long couponId);
}
