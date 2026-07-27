package com.pyq.platform.service;

import com.pyq.platform.entity.EmailLog;
import com.pyq.platform.entity.Payment;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.EmailLogRepository;
import com.pyq.platform.repository.UserRepository;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;
    private final EmailLogRepository emailLogRepository;
    private final UserRepository userRepository;

    @Value("${app.email.from:AIRGATE Team <support@airgate.in>}")
    private String fromEmail;

    @Value("${app.frontend.url:http://localhost:5173}")
    private String frontendUrl;

    /**
     * Send raw HTML email helper
     */
    public boolean sendHtmlEmail(String toEmail, String subject, String htmlContent, String emailType) {
        try {
            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom(fromEmail);
            helper.setTo(toEmail);
            helper.setSubject(subject);
            helper.setText(htmlContent, true);

            mailSender.send(message);

            emailLogRepository.save(EmailLog.builder()
                    .recipientEmail(toEmail)
                    .subject(subject)
                    .emailType(emailType)
                    .status("SENT")
                    .sentAt(LocalDateTime.now())
                    .build());

            log.info("Email [{}] successfully sent to {}", emailType, toEmail);
            return true;
        } catch (Exception e) {
            log.error("Failed to send [{}] email to {}: {}", emailType, toEmail, e.getMessage());
            emailLogRepository.save(EmailLog.builder()
                    .recipientEmail(toEmail)
                    .subject(subject)
                    .emailType(emailType)
                    .status("FAILED")
                    .sentAt(LocalDateTime.now())
                    .errorMessage(e.getMessage())
                    .build());
            return false;
        }
    }

    /**
     * Trigger A: Welcome Email (Triggered upon registration)
     */
    @Async
    public void sendWelcomeEmail(User user) {
        String subject = "Welcome to AIRGATE 🎯 - Your Strategic Roadmap for GATE CSE";
        String body = buildWelcomeEmailTemplate(user.getUsername());
        sendHtmlEmail(user.getEmail(), subject, body, "WELCOME_EMAIL");
    }

    /**
     * Trigger B: Aspirant Guidance & Feature Walkthrough (Nudge Email)
     */
    @Async
    public void sendGuidanceNudgeEmail(User user) {
        String subject = "Mastering GATE CSE: How Double-Verified Qs & AI Tutor Help You Rank Top 100";
        String body = buildGuidanceEmailTemplate(user.getUsername());
        sendHtmlEmail(user.getEmail(), subject, body, "GUIDANCE_NUDGE");
    }

    /**
     * Trigger C: Payment Success & Aspirant Pro Activation Confirmation
     */
    @Async
    public void sendPaymentSuccessEmail(User user, Payment payment) {
        String subject = "✨ Aspirant Pro Active! Your Gateway to Top GATE Rank";
        String body = buildPaymentSuccessEmailTemplate(user.getUsername(), payment);
        sendHtmlEmail(user.getEmail(), subject, body, "PAYMENT_SUCCESS");
    }

    /**
     * Admin Broadcast Engine (Targeted Batch Mailing)
     */
    @Async
    public void sendBatchBroadcast(String targetSegment, String subject, String bodyHtml, String customSingleEmail) {
        List<User> recipients;

        if ("SINGLE".equalsIgnoreCase(targetSegment) && customSingleEmail != null && !customSingleEmail.isBlank()) {
            recipients = userRepository.findByEmail(customSingleEmail).stream().toList();
        } else if ("FREE".equalsIgnoreCase(targetSegment)) {
            recipients = userRepository.findAll().stream()
                    .filter(u -> u.getIsPremium() == null || !u.getIsPremium())
                    .toList();
        } else if ("PREMIUM".equalsIgnoreCase(targetSegment)) {
            recipients = userRepository.findAll().stream()
                    .filter(u -> Boolean.TRUE.equals(u.getIsPremium()))
                    .toList();
        } else {
            // ALL
            recipients = userRepository.findAll();
        }

        log.info("Starting Admin Email Broadcast to {} users (Segment: {})", recipients.size(), targetSegment);

        for (User user : recipients) {
            String personalizedBody = buildBrandedLayout(user.getUsername(), bodyHtml);
            sendHtmlEmail(user.getEmail(), subject, personalizedBody, "ADMIN_BROADCAST_" + targetSegment.toUpperCase());
            try {
                Thread.sleep(100); // 100ms pause to prevent SMTP rate-limiting
            } catch (InterruptedException ignored) {}
        }
    }

    // ── HTML Templates Generator ───────────────────────────────────────────

    private String buildBrandedLayout(String username, String contentHtml) {
        String safeName = username != null ? username : "Aspirant";
        int year = java.time.Year.now().getValue();
        return "<!DOCTYPE html>" +
               "<html>" +
               "<head>" +
               "  <meta charset=\"utf-8\">" +
               "  <style>" +
               "    body { font-family: 'Segoe UI', Arial, sans-serif; background-color: #0b0f19; color: #f1f5f9; margin: 0; padding: 20px; }" +
               "    .container { max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid rgba(139, 92, 246, 0.25); overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }" +
               "    .header { background: linear-gradient(135deg, #06b6d4 0%, #8b5cf6 50%, #ec4899 100%); padding: 28px; text-align: center; }" +
               "    .header h1 { margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; }" +
               "    .content { padding: 32px 28px; line-height: 1.7; color: #cbd5e1; font-size: 15px; }" +
               "    .cta-btn { display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 700; margin: 24px 0; text-align: center; }" +
               "    .footer { background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); }" +
               "  </style>" +
               "</head>" +
               "<body>" +
               "  <div class=\"container\">" +
               "    <div class=\"header\">" +
               "      <h1>AIRGATE</h1>" +
               "      <div style=\"font-size: 12px; color: rgba(255,255,255,0.85); margin-top: 4px;\">Gateway to All India Rank | GATE CSE</div>" +
               "    </div>" +
               "    <div class=\"content\">" +
               "      <p style=\"font-size: 17px; color: #ffffff;\">Hi " + safeName + " 👋,</p>" +
               contentHtml +
               "    </div>" +
               "    <div class=\"footer\">" +
               "      © " + year + " AIRGATE CSE Prep Platform. All rights reserved.<br>" +
               "      Need help? Reach out to our mentors at <a href=\"mailto:support@airgate.in\" style=\"color: #8b5cf6;\">support@airgate.in</a>" +
               "    </div>" +
               "  </div>" +
               "</body>" +
               "</html>";
    }

    private String buildWelcomeEmailTemplate(String username) {
        String body = """
        <p>Welcome to <strong>AIRGATE</strong>! We are thrilled to partner with you on your journey toward cracking <strong>GATE Computer Science (CSE)</strong> with a top rank.</p>
        <p>Here is how you can jumpstart your preparation today:</p>
        <ul style="padding-left: 20px;">
          <li><strong>📜 100% Verified PYQs:</strong> Access chapter-wise previous year questions with step-by-step mathematical proofs.</li>
          <li><strong>⚡ Smart Hybrid Mocks:</strong> Test your conceptual clarity with a mix of 70% fresh double-verified questions + 30% high-yield PYQs.</li>
          <li><strong>🤖 Instant AI Tutor:</strong> Stuck on a tricky question? Ask our AI Tutor for instant hints without looking at the answer!</li>
        </ul>
        <div style="text-align: center;">
          <a href="%s/explore" class="cta-btn">🚀 Start Practicing Now</a>
        </div>
        <p>Stay consistent, keep practicing, and remember: Every question solved brings you closer to your dream IISc / IIT!</p>
        <p>Warm regards,<br><strong>Team AIRGATE Mentors</strong></p>
        """.formatted(frontendUrl);
        return buildBrandedLayout(username, body);
    }

    private String buildGuidanceEmailTemplate(String username) {
        String body = """
        <p>Preparing for GATE CSE requires a balanced blend of <strong>speed, conceptual depth, and error elimination</strong>.</p>
        <p>Here are 3 key strategies top rankers use on AIRGATE:</p>
        <ol style="padding-left: 20px;">
          <li><strong>Mistake Notebook:</strong> Bookmark questions you get wrong and review them weekly in <em>Prep Analyst</em>.</li>
          <li><strong>Timed Simulator:</strong> Practice full-length mocks under exact GATE exam interface conditions to build stamina.</li>
          <li><strong>Deep AI Clarifications:</strong> Use AI Tutor to break down complex Algorithm proofs and System Architecture problems line-by-line.</li>
        </ol>
        <div style="text-align: center;">
          <a href="%s/simulator" class="cta-btn">🎯 Try a Smart Mock Exam</a>
        </div>
        <p>Keep pushing your limits!</p>
        """.formatted(frontendUrl);
        return buildBrandedLayout(username, body);
    }

    private String buildPaymentSuccessEmailTemplate(String username, Payment payment) {
        String body = """
        <div style="background-color: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center;">
          <h3 style="color: #10b981; margin: 0 0 6px 0;">🎉 Congratulations! Your Aspirant Pro Membership is Active!</h3>
          <p style="margin: 0; color: #a7f3d0; font-size: 14px;">Order ID: %s | Duration: %d Month(s)</p>
        </div>
        <p>Thank you for upgrading to <strong>AIRGATE Aspirant Pro</strong>! Your membership unlocks all premium features designed for serious aspirants:</p>
        <ul style="padding-left: 20px;">
          <li><strong>⚡ Uncapped AI Tutor Access:</strong> 50 deep query clarifications per day.</li>
          <li><strong>🧠 Comprehensive Math Proofs:</strong> Detailed solutions for all GATE PYQs.</li>
          <li><strong>🎯 Unlimited Custom Subject Mocks:</strong> Create targeted mock tests for weak subjects.</li>
        </ul>
        <div style="text-align: center;">
          <a href="%s/explore" class="cta-btn">🔥 Access Pro Dashboard</a>
        </div>
        <p>If you have any questions regarding your invoice or subscription, feel free to reply directly to this email.</p>
        """.formatted(payment.getOrderId(), payment.getDurationMonths(), frontendUrl);
        return buildBrandedLayout(username, body);
    }

    /**
     * Trigger D: Password Reset OTP Email
     */
    public boolean sendPasswordResetOtpEmail(String toEmail, String username, String otp) {
        String subject = "🔐 Your AIRGATE Password Reset OTP";
        String body = """
        <div style="background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(6,182,212,0.08)); border: 1px solid rgba(99,102,241,0.3); border-radius: 16px; padding: 24px; margin-bottom: 24px; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 12px;">🔐</div>
          <h2 style="color: #ffffff; margin: 0 0 8px 0; font-size: 22px; font-weight: 800;">Your Password Reset OTP</h2>
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">Valid for 10 minutes only</p>
        </div>
        <p>Hi <strong>%s</strong>,</p>
        <p>We received a request to reset your AIRGATE account password. Use the OTP below to proceed:</p>
        <div style="text-align: center; margin: 32px 0;">
          <div style="display: inline-block; background: linear-gradient(135deg, #6366f1, #38bdf8); border-radius: 16px; padding: 20px 40px;">
            <div style="font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #ffffff; font-family: 'Courier New', monospace;">%s</div>
          </div>
        </div>
        <p style="color: #94a3b8; font-size: 13px;">⏰ This OTP expires in <strong style="color: #f59e0b;">10 minutes</strong>.</p>
        <p style="color: #94a3b8; font-size: 13px;">🔒 If you did NOT request this reset, please ignore this email. Your password remains unchanged and your account is secure.</p>
        <p>Stay focused on your GATE preparation! 🎯<br><strong>Team AIRGATE</strong></p>
        """.formatted(username, otp);
        String html = buildBrandedLayout(username, body);
        return sendHtmlEmail(toEmail, subject, html, "PASSWORD_RESET_OTP");
    }
}
