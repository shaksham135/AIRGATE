package com.pyq.platform.controller;

import com.pyq.platform.entity.SystemSettings;
import com.pyq.platform.repository.SystemSettingsRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.math.BigDecimal;

@RestController
@RequestMapping("/api/admin/settings")
public class SystemSettingsController {

    private final SystemSettingsRepository systemSettingsRepository;

    public SystemSettingsController(SystemSettingsRepository systemSettingsRepository) {
        this.systemSettingsRepository = systemSettingsRepository;
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getSettings() {
        SystemSettings settings = systemSettingsRepository.findById(1)
                .orElseGet(() -> {
                    SystemSettings defaultSettings = SystemSettings.builder()
                            .id(1)
                            .premiumPriceInr(BigDecimal.valueOf(299.00))
                            .premiumDurationMonths(3)
                            .aiDailyLimitPremium(100)
                            .isMaintenanceMode(false)
                            .tier1PriceInr(BigDecimal.valueOf(199.00))
                            .tier1DurationMonths(1)
                            .tier1SpecialOffer("Starter Pass")
                            .tier2PriceInr(BigDecimal.valueOf(299.00))
                            .tier2DurationMonths(3)
                            .tier2SpecialOffer("Save 15% - Most Popular")
                            .tier3PriceInr(BigDecimal.valueOf(449.00))
                            .tier3DurationMonths(6)
                            .tier3SpecialOffer("Save 25% - Complete Prep")
                            .seoSiteTitle("AIRGATE – Gateway to Top All India Ranks | GATE PYQs & AI Tutor")
                            .seoMetaDescription("Ace GATE 2027 exam with AIRGATE. Solve 20+ years of GATE previous year question papers (PYQs) with step-by-step AI tutor solutions, subject-wise analytics, and dynamic mock tests.")
                            .seoKeywords("GATE 2027, AIRGATE, GATE CS PYQ, Previous Year Questions, GATE Operating Systems, GATE Mock Test, AI GATE Tutor")
                            .googleSiteVerification("google-site-verification-placeholder")
                            .build();
                    return systemSettingsRepository.save(defaultSettings);
                });
        return ResponseEntity.ok(settings);
    }

    @GetMapping("/public-meta")
    @PreAuthorize("permitAll()")
    @Cacheable(value = "publicMeta")
    public ResponseEntity<?> getPublicSeoMeta() {
        SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
        if (settings == null) {
            return ResponseEntity.ok(java.util.Map.of(
                "seoSiteTitle", "AIRGATE – Gateway to Top All India Ranks | GATE PYQs & AI Tutor",
                "seoMetaDescription", "Ace GATE 2027 exam with AIRGATE. Solve 20+ years of GATE previous year question papers (PYQs) with step-by-step AI tutor solutions, subject-wise analytics, and dynamic mock tests.",
                "seoKeywords", "GATE 2027, GATE PYQ, AIRGATE, GATE Prep",
                "googleSiteVerification", ""
            ));
        }
        return ResponseEntity.ok(java.util.Map.of(
            "seoSiteTitle", settings.getSeoSiteTitle() != null ? settings.getSeoSiteTitle() : "AIRGATE – Gateway to Top All India Ranks | GATE PYQs & AI Tutor",
            "seoMetaDescription", settings.getSeoMetaDescription() != null ? settings.getSeoMetaDescription() : "Ace GATE 2027 exam with AIRGATE. Solve 20+ years of GATE previous year question papers (PYQs) with step-by-step AI tutor solutions, subject-wise analytics, and dynamic mock tests.",
            "seoKeywords", settings.getSeoKeywords() != null ? settings.getSeoKeywords() : "GATE 2027, GATE PYQ, AIRGATE, GATE Prep",
            "googleSiteVerification", settings.getGoogleSiteVerification() != null ? settings.getGoogleSiteVerification() : "",
            "umamiWebsiteId", settings.getUmamiWebsiteId() != null ? settings.getUmamiWebsiteId() : "",
            "supportEmail", settings.getSupportEmail() != null ? settings.getSupportEmail() : "support@airgate.in",
            "supportPhone", settings.getSupportPhone() != null ? settings.getSupportPhone() : "+91 (800) AIR-GATE"
        ));
    }

    @PutMapping
    @PreAuthorize("hasRole('ADMIN')")
    @CacheEvict(value = "publicMeta", allEntries = true)
    public ResponseEntity<?> updateSettings(@RequestBody SystemSettings newSettings) {
        SystemSettings settings = systemSettingsRepository.findById(1)
                .orElse(SystemSettings.builder().id(1).build());

        if (newSettings.getPremiumPriceInr() != null) {
            settings.setPremiumPriceInr(newSettings.getPremiumPriceInr());
        }
        if (newSettings.getPremiumDurationMonths() != null) {
            settings.setPremiumDurationMonths(newSettings.getPremiumDurationMonths());
        }
        if (newSettings.getAiDailyLimitPremium() != null) {
            settings.setAiDailyLimitPremium(newSettings.getAiDailyLimitPremium());
        }
        if (newSettings.getIsMaintenanceMode() != null) {
            settings.setIsMaintenanceMode(newSettings.getIsMaintenanceMode());
        }

        // Map Multi-Tiers
        if (newSettings.getTier1PriceInr() != null) {
            settings.setTier1PriceInr(newSettings.getTier1PriceInr());
        }
        if (newSettings.getTier1DurationMonths() != null) {
            settings.setTier1DurationMonths(newSettings.getTier1DurationMonths());
        }
        if (newSettings.getTier1SpecialOffer() != null) {
            settings.setTier1SpecialOffer(newSettings.getTier1SpecialOffer());
        }

        if (newSettings.getTier2PriceInr() != null) {
            settings.setTier2PriceInr(newSettings.getTier2PriceInr());
        }
        if (newSettings.getTier2DurationMonths() != null) {
            settings.setTier2DurationMonths(newSettings.getTier2DurationMonths());
        }
        if (newSettings.getTier2SpecialOffer() != null) {
            settings.setTier2SpecialOffer(newSettings.getTier2SpecialOffer());
        }

        if (newSettings.getTier3PriceInr() != null) {
            settings.setTier3PriceInr(newSettings.getTier3PriceInr());
        }
        if (newSettings.getTier3DurationMonths() != null) {
            settings.setTier3DurationMonths(newSettings.getTier3DurationMonths());
        }
        if (newSettings.getTier3SpecialOffer() != null) {
            settings.setTier3SpecialOffer(newSettings.getTier3SpecialOffer());
        }

        // Map SEO Meta Tags
        if (newSettings.getSeoSiteTitle() != null) {
            settings.setSeoSiteTitle(newSettings.getSeoSiteTitle());
        }
        if (newSettings.getSeoMetaDescription() != null) {
            settings.setSeoMetaDescription(newSettings.getSeoMetaDescription());
        }
        if (newSettings.getSeoKeywords() != null) {
            settings.setSeoKeywords(newSettings.getSeoKeywords());
        }
        if (newSettings.getGoogleSiteVerification() != null) {
            settings.setGoogleSiteVerification(newSettings.getGoogleSiteVerification());
        }
        if (newSettings.getUmamiWebsiteId() != null) {
            settings.setUmamiWebsiteId(newSettings.getUmamiWebsiteId());
        }

        // Map AI Generator Control Settings
        if (newSettings.getAiGeneratorEnabled() != null) {
            settings.setAiGeneratorEnabled(newSettings.getAiGeneratorEnabled());
        }
        if (newSettings.getAiGeneratorStartHour() != null) {
            settings.setAiGeneratorStartHour(newSettings.getAiGeneratorStartHour());
        }
        if (newSettings.getAiGeneratorEndHour() != null) {
            settings.setAiGeneratorEndHour(newSettings.getAiGeneratorEndHour());
        }

        // Map Support Contact Info
        if (newSettings.getSupportEmail() != null) {
            settings.setSupportEmail(newSettings.getSupportEmail());
        }
        if (newSettings.getSupportPhone() != null) {
            settings.setSupportPhone(newSettings.getSupportPhone());
        }
        if (newSettings.getFrontendBaseUrl() != null) {
            settings.setFrontendBaseUrl(newSettings.getFrontendBaseUrl());
        }

        // Map Email Automation Settings
        if (newSettings.getAutoWelcomeEmailEnabled() != null) {
            settings.setAutoWelcomeEmailEnabled(newSettings.getAutoWelcomeEmailEnabled());
        }
        if (newSettings.getAutoDripOfferEmailEnabled() != null) {
            settings.setAutoDripOfferEmailEnabled(newSettings.getAutoDripOfferEmailEnabled());
        }

        SystemSettings saved = systemSettingsRepository.save(settings);
        return ResponseEntity.ok(saved);
    }
}
