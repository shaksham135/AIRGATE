package com.pyq.platform.service;

import com.pyq.platform.dto.CouponValidateRequest;
import com.pyq.platform.dto.CouponValidateResponse;
import com.pyq.platform.entity.Coupon;
import com.pyq.platform.entity.CouponRedemption;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.CouponRedemptionRepository;
import com.pyq.platform.repository.CouponRepository;
import com.pyq.platform.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@Slf4j
public class CouponService {

    private final CouponRepository couponRepository;
    private final CouponRedemptionRepository redemptionRepository;
    private final UserRepository userRepository;

    public CouponService(CouponRepository couponRepository,
                         CouponRedemptionRepository redemptionRepository,
                         UserRepository userRepository) {
        this.couponRepository = couponRepository;
        this.redemptionRepository = redemptionRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public CouponValidateResponse validateCoupon(CouponValidateRequest req, Long userId) {
        if (req == null || req.getCode() == null || req.getCode().isBlank()) {
            return CouponValidateResponse.builder()
                    .valid(false)
                    .message("Please enter a valid coupon code.")
                    .build();
        }

        String cleanCode = req.getCode().trim().toUpperCase();
        Optional<Coupon> couponOpt = couponRepository.findByCodeIgnoreCase(cleanCode);

        if (couponOpt.isEmpty()) {
            return CouponValidateResponse.builder()
                    .valid(false)
                    .message("Invalid coupon code '" + cleanCode + "'.")
                    .build();
        }

        Coupon coupon = couponOpt.get();

        // 1. Active Check
        if (Boolean.FALSE.equals(coupon.getActive())) {
            return CouponValidateResponse.builder()
                    .valid(false)
                    .message("Coupon '" + cleanCode + "' is inactive.")
                    .build();
        }

        // 2. Expiry Check
        LocalDateTime now = LocalDateTime.now();
        if (coupon.getValidFrom() != null && now.isBefore(coupon.getValidFrom())) {
            return CouponValidateResponse.builder()
                    .valid(false)
                    .message("Coupon '" + cleanCode + "' is not yet active.")
                    .build();
        }
        if (coupon.getValidUntil() != null && now.isAfter(coupon.getValidUntil())) {
            return CouponValidateResponse.builder()
                    .valid(false)
                    .message("Coupon '" + cleanCode + "' has expired.")
                    .build();
        }

        // 3. Total Usage Capacity Check
        if (coupon.getMaxUses() != null && coupon.getCurrentUses() >= coupon.getMaxUses()) {
            return CouponValidateResponse.builder()
                    .valid(false)
                    .message("Coupon '" + cleanCode + "' maximum redemption limit has been reached.")
                    .build();
        }

        // 4. Per-User Usage Check
        if (userId != null && coupon.getMaxUsesPerUser() != null) {
            long userUses = redemptionRepository.countByUserIdAndCouponId(userId, coupon.getId());
            if (userUses >= coupon.getMaxUsesPerUser()) {
                return CouponValidateResponse.builder()
                        .valid(false)
                        .message("You have already used coupon '" + cleanCode + "'.")
                        .build();
            }
        }

        // 5. Tier Matching Check
        if (coupon.getApplicableTier() != Coupon.PlanTier.ALL && req.getPlanTier() != null) {
            String reqTierStr = req.getPlanTier().trim().toUpperCase();
            String couponTierStr = coupon.getApplicableTier().name();
            if (!couponTierStr.equalsIgnoreCase(reqTierStr)) {
                return CouponValidateResponse.builder()
                        .valid(false)
                        .message("Coupon '" + cleanCode + "' is valid only for " + couponTierStr + " plan tier.")
                        .build();
            }
        }

        // 6. Minimum Order Amount Check
        BigDecimal originalPrice = req.getOriginalPrice() != null ? req.getOriginalPrice() : BigDecimal.ZERO;
        if (coupon.getMinOrderAmount() != null && originalPrice.compareTo(coupon.getMinOrderAmount()) < 0) {
            return CouponValidateResponse.builder()
                    .valid(false)
                    .message("Minimum order amount of ₹" + coupon.getMinOrderAmount() + " required for coupon '" + cleanCode + "'.")
                    .build();
        }

        // 7. Calculate Discount Amount
        BigDecimal discountAmount = BigDecimal.ZERO;
        if (coupon.getDiscountType() == Coupon.DiscountType.PERCENTAGE) {
            discountAmount = originalPrice.multiply(coupon.getDiscountValue())
                    .divide(new BigDecimal("100"), 2, RoundingMode.HALF_UP);
        } else if (coupon.getDiscountType() == Coupon.DiscountType.FLAT) {
            discountAmount = coupon.getDiscountValue();
        }

        // Bound discount amount to original price
        if (discountAmount.compareTo(originalPrice) > 0) {
            discountAmount = originalPrice;
        }

        BigDecimal finalPrice = originalPrice.subtract(discountAmount);
        if (finalPrice.compareTo(BigDecimal.ZERO) < 0) {
            finalPrice = BigDecimal.ZERO;
        }

        return CouponValidateResponse.builder()
                .valid(true)
                .message("🎉 Coupon '" + cleanCode + "' applied successfully!")
                .code(coupon.getCode())
                .discountType(coupon.getDiscountType().name())
                .discountValue(coupon.getDiscountValue())
                .originalPrice(originalPrice)
                .discountAmount(discountAmount)
                .finalPrice(finalPrice)
                .applicableTier(coupon.getApplicableTier().name())
                .build();
    }

    @Transactional
    public void recordRedemption(String code, Long userId, BigDecimal orderAmount, BigDecimal discountAmount, BigDecimal finalAmount) {
        if (code == null || userId == null) return;
        String cleanCode = code.trim().toUpperCase();

        Optional<Coupon> couponOpt = couponRepository.findByCodeIgnoreCase(cleanCode);
        if (couponOpt.isEmpty()) return;

        Coupon coupon = couponOpt.get();
        User user = userRepository.findById(userId).orElse(null);
        if (user == null) return;

        // Atomic Increment Current Uses
        couponRepository.incrementCurrentUses(coupon.getId());

        CouponRedemption redemption = CouponRedemption.builder()
                .coupon(coupon)
                .user(user)
                .orderAmount(orderAmount)
                .discountAmount(discountAmount)
                .finalAmount(finalAmount)
                .build();

        redemptionRepository.save(redemption);
        log.info("💳 Coupon '{}' redeemed by User ID {}. Savings: ₹{}", cleanCode, userId, discountAmount);
    }
}
