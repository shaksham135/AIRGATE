package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "system_settings")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SystemSettings {

    @Id
    private Integer id; // Always 1 for singleton configuration

    @Column(name = "premium_price_inr", nullable = false)
    private BigDecimal premiumPriceInr;

    @Column(name = "premium_duration_months", nullable = false)
    private Integer premiumDurationMonths;

    @Column(name = "ai_daily_limit_premium", nullable = false)
    private Integer aiDailyLimitPremium;

    @Column(name = "is_maintenance_mode", nullable = false)
    private Boolean isMaintenanceMode;

    // Dynamic Multi-Tier Pricing Packages
    @Column(name = "tier1_price_inr", nullable = false)
    private BigDecimal tier1PriceInr;

    @Column(name = "tier1_duration_months", nullable = false)
    private Integer tier1DurationMonths;

    @Column(name = "tier1_special_offer")
    private String tier1SpecialOffer;

    @Column(name = "tier2_price_inr", nullable = false)
    private BigDecimal tier2PriceInr;

    @Column(name = "tier2_duration_months", nullable = false)
    private Integer tier2DurationMonths;

    @Column(name = "tier2_special_offer")
    private String tier2SpecialOffer;

    @Column(name = "tier3_price_inr", nullable = false)
    private BigDecimal tier3PriceInr;

    @Column(name = "tier3_duration_months", nullable = false)
    private Integer tier3DurationMonths;

    @Column(name = "tier3_special_offer")
    private String tier3SpecialOffer;

    // Dynamic SEO & Search Engine Optimization Fields
    @Column(name = "seo_site_title")
    private String seoSiteTitle;

    @Column(name = "seo_meta_description", length = 1000)
    private String seoMetaDescription;

    @Column(name = "seo_keywords", columnDefinition = "TEXT")
    private String seoKeywords;

    @Column(name = "google_site_verification")
    private String googleSiteVerification;

    @Column(name = "umami_website_id")
    private String umamiWebsiteId;

    // Automated AI Practice Generator Control Settings
    @Builder.Default
    @Column(name = "ai_generator_enabled", nullable = false)
    private Boolean aiGeneratorEnabled = true;

    @Builder.Default
    @Column(name = "ai_generator_start_hour", nullable = false)
    private Integer aiGeneratorStartHour = 0; // 00:00 AM IST

    @Builder.Default
    @Column(name = "ai_generator_end_hour", nullable = false)
    private Integer aiGeneratorEndHour = 4; // 04:00 AM IST

    // Dynamic Contact & Customer Support Settings
    @Builder.Default
    @Column(name = "support_email")
    private String supportEmail = "support@airgate.in";

    @Builder.Default
    @Column(name = "support_phone")
    private String supportPhone = "+91 (800) AIR-GATE";

    // Dynamic Automated Email Workflow Controls
    @Builder.Default
    @Column(name = "auto_welcome_email_enabled", nullable = false)
    private Boolean autoWelcomeEmailEnabled = true;

    @Builder.Default
    @Column(name = "auto_drip_offer_email_enabled", nullable = false)
    private Boolean autoDripOfferEmailEnabled = true;

    // Dynamic Hybrid VIP Beta Payment Settings
    @Builder.Default
    @Column(name = "beta_payment_enabled", nullable = false)
    private Boolean betaPaymentEnabled = true;

    @Builder.Default
    @Column(name = "beta_upi_id")
    private String betaUpiId = "airgate@upi";

    @Column(name = "beta_qr_image_url", columnDefinition = "TEXT")
    private String betaQrImageUrl;

    @Builder.Default
    @Column(name = "beta_spots_remaining", nullable = false)
    private Integer betaSpotsRemaining = 100;

    @Builder.Default
    @Column(name = "beta_tier1_price", nullable = false)
    private BigDecimal betaTier1Price = new BigDecimal("49.00");

    @Builder.Default
    @Column(name = "beta_tier2_price", nullable = false)
    private BigDecimal betaTier2Price = new BigDecimal("249.00");
}
