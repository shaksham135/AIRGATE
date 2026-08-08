package com.pyq.platform.controller;

import com.pyq.platform.entity.EmailLog;
import com.pyq.platform.repository.EmailLogRepository;
import com.pyq.platform.service.EmailService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/email")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class AdminEmailController {

    private final EmailService emailService;
    private final EmailLogRepository emailLogRepository;

    @PostMapping("/broadcast")
    public ResponseEntity<?> sendBroadcast(@RequestBody BroadcastRequestDTO request) {
        if (request.getSubject() == null || request.getSubject().isBlank() ||
            request.getBodyHtml() == null || request.getBodyHtml().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Subject and HTML body are required."));
        }

        emailService.sendBatchBroadcast(
                request.getTargetSegment(),
                request.getSubject(),
                request.getBodyHtml(),
                request.getCustomSingleEmail()
        );

        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Broadcast triggered successfully! Emails are being dispatched in background."
        ));
    }

    @PostMapping("/test")
    public ResponseEntity<?> sendTestEmail(@RequestBody Map<String, String> body) {
        String targetEmail = body.get("email");
        if (targetEmail == null || targetEmail.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Target email address is required."));
        }

        boolean sent = emailService.sendTestEmail(targetEmail.trim());
        if (sent) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Test email successfully dispatched to " + targetEmail));
        } else {
            return ResponseEntity.status(500).body(Map.of("error", "Failed to send test email. Please check server logs and Brevo API Key / SMTP settings."));
        }
    }

    @GetMapping("/logs")
    public ResponseEntity<?> getEmailLogs() {
        List<EmailLog> logs = emailLogRepository.findTop50ByOrderBySentAtDesc();
        return ResponseEntity.ok(logs);
    }

    @Data
    public static class BroadcastRequestDTO {
        private String targetSegment; // ALL, FREE, PREMIUM, SINGLE
        private String subject;
        private String bodyHtml;
        private String customSingleEmail;
    }
}
