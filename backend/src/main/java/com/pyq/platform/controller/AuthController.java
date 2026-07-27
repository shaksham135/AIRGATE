package com.pyq.platform.controller;

import com.pyq.platform.dto.JwtResponse;
import com.pyq.platform.dto.LoginRequest;
import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.dto.RegisterRequest;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.JwtUtils;
import com.pyq.platform.security.UserDetailsImpl;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;


import com.pyq.platform.entity.LoginHistory;
import com.pyq.platform.repository.LoginHistoryRepository;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/api/auth")
@Slf4j
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final UserRepository userRepository;
    private final PasswordEncoder encoder;
    private final JwtUtils jwtUtils;
    private final LoginHistoryRepository loginHistoryRepository;
    private final com.pyq.platform.service.EmailService emailService;

    public AuthController(AuthenticationManager authenticationManager, UserRepository userRepository,
                          PasswordEncoder encoder, JwtUtils jwtUtils, LoginHistoryRepository loginHistoryRepository,
                          com.pyq.platform.service.EmailService emailService) {
        this.authenticationManager = authenticationManager;
        this.userRepository = userRepository;
        this.encoder = encoder;
        this.jwtUtils = jwtUtils;
        this.loginHistoryRepository = loginHistoryRepository;
        this.emailService = emailService;
    }

    @PostMapping("/login")
    @Transactional
    public ResponseEntity<?> authenticateUser(
            @Valid @RequestBody LoginRequest loginRequest,
            HttpServletRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getUsername(), loginRequest.getPassword()));

        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        
        String role = userDetails.getAuthorities().stream()
                .findFirst()
                .map(item -> item.getAuthority().replace("ROLE_", ""))
                .orElse("STUDENT");

        String jwt = jwtUtils.generateJwtToken(userDetails.getUsername(), role);

        // Save LoginHistory record
        try {
            User user = userRepository.findById(userDetails.getId()).orElse(null);
            if (user != null) {
                String ua = request.getHeader("User-Agent");
                String ip = getClientIp(request);
                LoginHistory history = LoginHistory.builder()
                        .user(user)
                        .ipAddress(ip)
                        .userAgent(ua)
                        .browser(parseBrowser(ua))
                        .operatingSystem(parseOS(ua))
                        .deviceType(parseDeviceType(ua))
                        .build();
                loginHistoryRepository.save(history);
            }
        } catch (Exception e) {
            // Keep login working even if analytics logging fails
            log.warn("Failed to save login history for user {}: {}", userDetails.getUsername(), e.getMessage());
        }

        return ResponseEntity.ok(new JwtResponse(
                jwt,
                userDetails.getId(),
                userDetails.getUsername(),
                userDetails.getEmail(),
                role,
                userDetails.isPremium(),
                userDetails.getPremiumExpiresAt()
        ));
    }

    private String getClientIp(HttpServletRequest request) {
        String ip = request.getHeader("X-Forwarded-For");
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getHeader("WL-Proxy-Client-IP");
        }
        if (ip == null || ip.isEmpty() || "unknown".equalsIgnoreCase(ip)) {
            ip = request.getRemoteAddr();
        }
        if (ip != null && ip.contains(",")) {
            ip = ip.split(",")[0].trim();
        }
        return ip;
    }

    private String parseBrowser(String ua) {
        if (ua == null) return "Unknown";
        String uaLower = ua.toLowerCase();
        if (uaLower.contains("chrome") && !uaLower.contains("chromium") && !uaLower.contains("edg") && !uaLower.contains("opr")) return "Chrome";
        if (uaLower.contains("safari") && !uaLower.contains("chrome") && !uaLower.contains("chromium")) return "Safari";
        if (uaLower.contains("firefox")) return "Firefox";
        if (uaLower.contains("edg")) return "Edge";
        if (uaLower.contains("opr") || uaLower.contains("opera")) return "Opera";
        return "Browser/HttpClient";
    }

    private String parseOS(String ua) {
        if (ua == null) return "Unknown";
        String uaLower = ua.toLowerCase();
        if (uaLower.contains("windows")) return "Windows";
        if (uaLower.contains("macintosh") || uaLower.contains("mac os")) return "macOS";
        if (uaLower.contains("android")) return "Android";
        if (uaLower.contains("iphone") || uaLower.contains("ipad")) return "iOS";
        if (uaLower.contains("linux")) return "Linux";
        return "Other";
    }

    private String parseDeviceType(String ua) {
        if (ua == null) return "Desktop";
        String uaLower = ua.toLowerCase();
        if (uaLower.contains("mobile") || uaLower.contains("iphone") || uaLower.contains("android")) {
            if (uaLower.contains("ipad") || uaLower.contains("tablet")) return "Tablet";
            return "Mobile";
        }
        if (uaLower.contains("ipad") || uaLower.contains("tablet")) return "Tablet";
        return "Desktop";
    }

    @PostMapping("/register")
    @Transactional
    public ResponseEntity<?> registerUser(@Valid @RequestBody RegisterRequest signUpRequest) {
        if (userRepository.existsByUsername(signUpRequest.getUsername())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Username is already taken!"));
        }

        if (userRepository.existsByEmail(signUpRequest.getEmail())) {
            return ResponseEntity
                    .badRequest()
                    .body(new MessageResponse("Error: Email is already in use!"));
        }

        // Public registration strictly assigns STUDENT role
        User.UserRole userRole = User.UserRole.STUDENT;

        // Create new user's account
        User user = User.builder()
                .username(signUpRequest.getUsername())
                .email(signUpRequest.getEmail())
                .passwordHash(encoder.encode(signUpRequest.getPassword()))
                .role(userRole)
                .build();

        userRepository.save(user);

        // Async Welcome Email Trigger
        try {
            emailService.sendWelcomeEmail(user);
        } catch (Exception e) {
            log.warn("Failed to trigger welcome email for user {}: {}", user.getUsername(), e.getMessage());
        }

        return ResponseEntity.ok(new MessageResponse("User registered successfully!"));
    }

    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    @Transactional
    public ResponseEntity<?> changePassword(
            @Valid @RequestBody com.pyq.platform.dto.PasswordChangeRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        User user = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new RuntimeException("Error: User not found."));

        if (!encoder.matches(request.getCurrentPassword(), user.getPasswordHash())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Current password is incorrect!"));
        }

        if (request.getNewPassword() == null || request.getNewPassword().trim().length() < 6) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: New password must be at least 6 characters!"));
        }

        user.setPasswordHash(encoder.encode(request.getNewPassword()));
        userRepository.save(user);

        return ResponseEntity.ok(new MessageResponse("Password changed successfully!"));
    }

    // ── OTP-BASED FORGOT PASSWORD FLOW ────────────────────────────────────────

    /**
     * Step 1: POST /api/auth/forgot-password
     * Accepts email, generates 6-digit OTP, saves to User, sends email.
     */
    @PostMapping("/forgot-password")
    @Transactional
    public ResponseEntity<?> forgotPassword(@RequestBody java.util.Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        if (email.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email is required!"));
        }

        java.util.Optional<User> userOpt = userRepository.findByEmail(email);
        // Always return success to prevent email enumeration attacks
        if (userOpt.isEmpty()) {
            return ResponseEntity.ok(new MessageResponse("If this email is registered, you will receive an OTP shortly."));
        }

        User user = userOpt.get();

        // Generate 6-digit OTP
        String otp = String.format("%06d", new java.util.Random().nextInt(999999));
        user.setPasswordResetOtp(otp);
        user.setOtpExpiresAt(java.time.LocalDateTime.now().plusMinutes(10));
        userRepository.save(user);

        // Send OTP Email
        boolean sent = emailService.sendPasswordResetOtpEmail(user.getEmail(), user.getUsername(), otp);
        if (!sent) {
            log.warn("Failed to send OTP email to {}", email);
        }

        return ResponseEntity.ok(new MessageResponse("If this email is registered, you will receive an OTP shortly."));
    }

    /**
     * Step 2: POST /api/auth/verify-otp
     * Verifies the OTP is correct and not expired.
     */
    @PostMapping("/verify-otp")
    @Transactional
    public ResponseEntity<?> verifyOtp(@RequestBody java.util.Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String otp = body.getOrDefault("otp", "").trim();

        if (email.isBlank() || otp.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email and OTP are required!"));
        }

        java.util.Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid OTP or expired. Please request a new one."));
        }

        User user = userOpt.get();

        if (user.getPasswordResetOtp() == null || !user.getPasswordResetOtp().equals(otp)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Incorrect OTP. Please try again."));
        }

        if (user.getOtpExpiresAt() == null || java.time.LocalDateTime.now().isAfter(user.getOtpExpiresAt())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: OTP has expired. Please request a new one."));
        }

        return ResponseEntity.ok(new MessageResponse("OTP verified successfully!"));
    }

    /**
     * Step 3: POST /api/auth/reset-password
     * Verifies OTP one final time, then resets password and clears OTP fields.
     */
    @PostMapping("/reset-password")
    @Transactional
    public ResponseEntity<?> resetPassword(@RequestBody java.util.Map<String, String> body) {
        String email = body.getOrDefault("email", "").trim().toLowerCase();
        String otp = body.getOrDefault("otp", "").trim();
        String newPassword = body.getOrDefault("newPassword", "");

        if (email.isBlank() || otp.isBlank() || newPassword.isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Email, OTP, and new password are required!"));
        }

        if (newPassword.length() < 6) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Password must be at least 6 characters!"));
        }

        java.util.Optional<User> userOpt = userRepository.findByEmail(email);
        if (userOpt.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid request. Please start over."));
        }

        User user = userOpt.get();

        if (user.getPasswordResetOtp() == null || !user.getPasswordResetOtp().equals(otp)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid OTP. Please start over."));
        }

        if (user.getOtpExpiresAt() == null || java.time.LocalDateTime.now().isAfter(user.getOtpExpiresAt())) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: OTP has expired. Please request a new one."));
        }

        // Reset password and clear OTP fields
        user.setPasswordHash(encoder.encode(newPassword));
        user.setPasswordResetOtp(null);
        user.setOtpExpiresAt(null);
        userRepository.save(user);

        log.info("Password successfully reset for user: {}", user.getUsername());
        return ResponseEntity.ok(new MessageResponse("Password reset successfully! You can now sign in."));
    }
}


