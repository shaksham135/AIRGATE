package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "coupons", indexes = {
    @Index(name = "idx_coupon_code", columnList = "code"),
    @Index(name = "idx_coupon_active", columnList = "active")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Coupon {

    public enum DiscountType {
        PERCENTAGE,
        FLAT
    }

    public enum PlanTier {
        MONTHLY,
        QUARTERLY,
        SEASON,
        ANNUAL,
        ALL
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(name = "discount_type", nullable = false, length = 20)
    private DiscountType discountType;

    @Column(name = "discount_value", nullable = false, precision = 10, scale = 2)
    private BigDecimal discountValue;

    @Enumerated(EnumType.STRING)
    @Column(name = "applicable_tier", nullable = false, length = 20)
    private PlanTier applicableTier;

    @Builder.Default
    @Column(name = "max_uses")
    private Integer maxUses = 100;

    @Builder.Default
    @Column(name = "current_uses")
    private Integer currentUses = 0;

    @Builder.Default
    @Column(name = "max_uses_per_user")
    private Integer maxUsesPerUser = 1;

    @Builder.Default
    @Column(name = "min_order_amount", precision = 10, scale = 2)
    private BigDecimal minOrderAmount = BigDecimal.ZERO;

    @Column(name = "valid_from")
    private LocalDateTime validFrom;

    @Column(name = "valid_until")
    private LocalDateTime validUntil;

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
        if (validFrom == null) {
            validFrom = LocalDateTime.now();
        }
        if (code != null) {
            code = code.trim().toUpperCase();
        }
    }
}
