package com.pyq.platform.controller;

import com.pyq.platform.entity.SystemSettings;
import com.pyq.platform.repository.SystemSettingsRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/public")
public class PublicInfoController {

    private final SystemSettingsRepository systemSettingsRepository;

    @org.springframework.beans.factory.annotation.Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    public PublicInfoController(SystemSettingsRepository systemSettingsRepository) {
        this.systemSettingsRepository = systemSettingsRepository;
    }

    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getPlatformInfo() {
        SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
        Map<String, Object> response = new HashMap<>();
        response.put("platformName", "AIRGATE Platform");
        response.put("tagline", "Practice · Analyze · Progress");
        response.put("frontendUrl", frontendUrl);
        response.put("supportEmail", settings != null && settings.getSupportEmail() != null ? settings.getSupportEmail() : "support@airgate.in");
        response.put("supportPhone", settings != null && settings.getSupportPhone() != null ? settings.getSupportPhone() : "+91 (800) AIR-GATE");
        response.put("privacyPolicyUrl", "/privacy");
        response.put("termsOfServiceUrl", "/terms");
        response.put("contactUrl", "/contact");
        response.put("founder", "Shaksham");
        response.put("founderTitle", "Founder & Chief Architect");
        response.put("googleVerified", true);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/privacy")
    public ResponseEntity<Map<String, Object>> getPrivacyPolicy() {
        Map<String, Object> response = new HashMap<>();
        response.put("title", "Privacy Policy");
        response.put("effectiveDate", "2026-01-01");
        response.put("lastUpdated", "2026-07-26");
        response.put("dataCollected", new String[]{
            "Account Credentials (Username, Hashed Password, Email)",
            "Practice Performance Analytics & Mock Exam Attempts",
            "System Usage Logs & IP Address for Rate Limiting & Analytics"
        });
        response.put("googleAnalytics", "Google Search Console & Privacy Compliant Umami Analytics Integration");
        response.put("dataProtection", "Industry standard AES-256 and bcrypt hashing protocols.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/terms")
    public ResponseEntity<Map<String, Object>> getTermsOfService() {
        Map<String, Object> response = new HashMap<>();
        response.put("title", "Terms of Service");
        response.put("effectiveDate", "2026-01-01");
        response.put("fairUsePolicy", "AIRGATE GATE PYQs and AI Tutor tools are for personal educational use.");
        response.put("intellectualProperty", "All original GATE exam questions belong to official GATE organizing institutes (IITs/IISc). Solution commentary & AI Tutor responses are property of AIRGATE.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/support")
    public ResponseEntity<Map<String, Object>> getSupportInfo() {
        SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
        Map<String, Object> response = new HashMap<>();
        response.put("supportEmail", settings != null && settings.getSupportEmail() != null ? settings.getSupportEmail() : "support@airgate.in");
        response.put("supportPhone", settings != null && settings.getSupportPhone() != null ? settings.getSupportPhone() : "+91 (800) AIR-GATE");
        response.put("operatingHours", "Monday - Saturday: 9:00 AM - 8:00 PM IST");
        response.put("responseGuarantee", "Within 24 Hours");
        return ResponseEntity.ok(response);
    }
}
