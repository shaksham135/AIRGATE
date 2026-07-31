package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "promo_banners", indexes = {
    @Index(name = "idx_banner_active", columnList = "active")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PromoBanner {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String message;

    @Builder.Default
    @Column(name = "cta_text", length = 50)
    private String ctaText = "Claim Offer";

    @Builder.Default
    @Column(name = "cta_link", length = 255)
    private String ctaLink = "/pricing";

    @Column(name = "coupon_code", length = 50)
    private String couponCode;

    @Builder.Default
    @Column(name = "banner_type", length = 50)
    private String bannerType = "HEADER_BAR"; // HEADER_BAR, CARD_POPUP

    @Builder.Default
    @Column(name = "bg_color", length = 50)
    private String bgColor = "#8b5cf6";

    @Builder.Default
    @Column(name = "text_color", length = 50)
    private String textColor = "#ffffff";

    @Builder.Default
    @Column(nullable = false)
    private Boolean active = true;

    @Builder.Default
    @Column(nullable = false)
    private Integer priority = 0;

    @Column(name = "valid_until")
    private LocalDateTime validUntil;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
