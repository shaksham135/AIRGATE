package com.pyq.platform.scheduler;

import com.pyq.platform.repository.SystemSettingsRepository;
import com.pyq.platform.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

@Component
@Slf4j
public class SelfHealthMonitorScheduler {

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    @Value("${app.health.ping-url:}")
    private String selfPingUrl;

    private final JdbcTemplate jdbcTemplate;
    private final EmailService emailService;
    private final SystemSettingsRepository systemSettingsRepository;
    private final HttpClient httpClient;

    // Stateful flag to ensure EXACTLY ONE email alert on failure and ONE recovery email on restore
    private boolean isDownAlertSent = false;

    public SelfHealthMonitorScheduler(JdbcTemplate jdbcTemplate, 
                                     EmailService emailService,
                                     SystemSettingsRepository systemSettingsRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.emailService = emailService;
        this.systemSettingsRepository = systemSettingsRepository;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    /**
     * Self-Health & Keepalive check runs every 5 minutes.
     */
    @Scheduled(cron = "0 */5 * * * *")
    public void monitorHealthAndKeepAlive() {
        log.debug("SelfHealthMonitorScheduler: Running 5-minute health check tick...");

        boolean dbHealthy = checkDatabaseHealth();
        boolean pingHealthy = selfPingBackend();

        boolean isSystemHealthy = dbHealthy && pingHealthy;

        if (!isSystemHealthy) {
            log.warn("SelfHealthMonitorScheduler: Health check degraded! DB: {}, SelfPing: {}", dbHealthy, pingHealthy);

            if (!isDownAlertSent) {
                isDownAlertSent = true;
                sendAdminDowntimeAlert(dbHealthy, pingHealthy);
            }
        } else {
            // System is healthy
            if (isDownAlertSent) {
                // System was previously down and has now recovered
                log.info("SelfHealthMonitorScheduler: System has fully RECOVERED!");
                isDownAlertSent = false;
                sendAdminRecoveryAlert();
            } else {
                log.debug("SelfHealthMonitorScheduler: System healthy (DB OK, Self-Ping OK).");
            }
        }
    }

    private boolean checkDatabaseHealth() {
        try {
            Integer val = jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            return val != null && val == 1;
        } catch (Exception e) {
            log.error("SelfHealthMonitorScheduler: Database ping failed: {}", e.getMessage());
            return false;
        }
    }

    private boolean selfPingBackend() {
        if (selfPingUrl == null || selfPingUrl.trim().isEmpty()) {
            return true; // Skip if self ping URL not explicitly configured
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(selfPingUrl))
                    .timeout(Duration.ofSeconds(10))
                    .GET()
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.statusCode() == 200;
        } catch (Exception e) {
            log.warn("SelfHealthMonitorScheduler: Self-ping GET request failed: {}", e.getMessage());
            return false;
        }
    }

    private void sendAdminDowntimeAlert(boolean dbHealthy, boolean pingHealthy) {
        String adminEmail = getAdminSupportEmail();
        String subject = "🚨 CRITICAL: AIRGATE Server Health Degraded Alert";
        String htmlContent = "<div style='font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 12px;'>" +
                "<h2 style='color: #ef4444;'>🚨 AIRGATE Platform Alert — Server Degraded</h2>" +
                "<p>An automated health check detected a critical issue on the AIRGATE backend server.</p>" +
                "<ul style='line-height: 1.8;'>" +
                "<li><strong>Database Connectivity:</strong> " + (dbHealthy ? "<span style='color:#22c55e;'>CONNECTED</span>" : "<span style='color:#ef4444;'>DISCONNECTED / FAILED</span>") + "</li>" +
                "<li><strong>Self-Ping Endpoint:</strong> " + (pingHealthy ? "<span style='color:#22c55e;'>OK</span>" : "<span style='color:#ef4444;'>FAILED / TIMEOUT</span>") + "</li>" +
                "</ul>" +
                "<p style='color: #94a3b8; font-size: 0.85rem;'>Note: Duplicate emails are suppressed while the server remains degraded. You will receive a single recovery notification when health is restored.</p>" +
                "</div>";

        try {
            emailService.sendHtmlEmail(adminEmail, subject, htmlContent, "SYSTEM_HEALTH_ALERT");
            log.info("Downtime alert email sent to admin: {}", adminEmail);
        } catch (Exception e) {
            log.error("Failed to send downtime alert email to admin: {}", e.getMessage());
        }
    }

    private void sendAdminRecoveryAlert() {
        String adminEmail = getAdminSupportEmail();
        String subject = "✅ RECOVERED: AIRGATE Platform Server Restored";
        String htmlContent = "<div style='font-family: sans-serif; padding: 20px; background-color: #0f172a; color: #f8fafc; border-radius: 12px;'>" +
                "<h2 style='color: #22c55e;'>✅ AIRGATE Platform — Server Fully Online</h2>" +
                "<p>The AIRGATE backend server has successfully recovered and passed all database and health check diagnostics.</p>" +
                "<p style='color: #94a3b8; font-size: 0.85rem;'>System monitoring has returned to normal 5-minute ticks.</p>" +
                "</div>";

        try {
            emailService.sendHtmlEmail(adminEmail, subject, htmlContent, "SYSTEM_RECOVERY_ALERT");
            log.info("Recovery alert email sent to admin: {}", adminEmail);
        } catch (Exception e) {
            log.error("Failed to send recovery alert email to admin: {}", e.getMessage());
        }
    }

    private String getAdminSupportEmail() {
        try {
            var settings = systemSettingsRepository.findById(1).orElse(null);
            if (settings != null && settings.getSupportEmail() != null && !settings.getSupportEmail().isEmpty()) {
                return settings.getSupportEmail();
            }
        } catch (Exception ignored) {}
        return "shaksham135@gmail.com"; // Fallback admin email
    }
}
