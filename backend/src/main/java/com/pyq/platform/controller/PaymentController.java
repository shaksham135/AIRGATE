package com.pyq.platform.controller;

import com.pyq.platform.entity.Payment;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.PaymentRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/payments")
@Slf4j
public class PaymentController {

    @Value("${razorpay.key.id:}")
    private String keyId;

    @Value("${razorpay.key.secret:}")
    private String keySecret;

    private final PaymentRepository paymentRepository;
    private final UserRepository userRepository;
    private final com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository;
    private final com.pyq.platform.repository.PaymentVerificationRepository paymentVerificationRepository;
    private final com.pyq.platform.service.EmailService emailService;
    private final com.pyq.platform.service.CouponService couponService;
    private final RestTemplate restTemplate = new RestTemplate();

    public PaymentController(PaymentRepository paymentRepository,
            UserRepository userRepository,
            com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository,
            com.pyq.platform.repository.PaymentVerificationRepository paymentVerificationRepository,
            com.pyq.platform.service.EmailService emailService,
            com.pyq.platform.service.CouponService couponService) {
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.systemSettingsRepository = systemSettingsRepository;
        this.paymentVerificationRepository = paymentVerificationRepository;
        this.emailService = emailService;
        this.couponService = couponService;
    }

    private boolean isRazorpayConfigured() {
        return keyId != null && !keyId.isBlank() && !keyId.equalsIgnoreCase("placeholder")
                && !keyId.startsWith("YOUR_");
    }

    @GetMapping("/pricing")
    public ResponseEntity<?> getPricingTiers() {
        boolean rzpConfigured = isRazorpayConfigured();
        com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);

        boolean isBetaMode = true; // Default to Beta mode unless explicitly disabled and Razorpay is configured
        if (settings != null) {
            isBetaMode = Boolean.TRUE.equals(settings.getBetaPaymentEnabled()) || !rzpConfigured;
        }

        Map<String, Object> response = new HashMap<>();
        response.put("isBetaMode", isBetaMode);
        response.put("isRazorpayConfigured", rzpConfigured);
        response.put("enabled", rzpConfigured || isBetaMode);

        if (settings != null) {
            response.put("betaUpiId", settings.getBetaUpiId() != null ? settings.getBetaUpiId() : "airgate@upi");
            response.put("betaQrImageUrl", settings.getBetaQrImageUrl() != null ? settings.getBetaQrImageUrl() : "");
            response.put("betaSpotsRemaining",
                    settings.getBetaSpotsRemaining() != null ? settings.getBetaSpotsRemaining() : 100);
            response.put("betaTier1Price",
                    settings.getBetaTier1Price() != null ? settings.getBetaTier1Price() : new BigDecimal("49.00"));
            response.put("betaTier2Price",
                    settings.getBetaTier2Price() != null ? settings.getBetaTier2Price() : new BigDecimal("149.00"));
            response.put("betaTier3Price",
                    settings.getBetaTier3Price() != null ? settings.getBetaTier3Price() : new BigDecimal("249.00"));
            response.put("betaBannerHeading",
                    settings.getBetaBannerHeading() != null ? settings.getBetaBannerHeading() : "⚡ Limited Founder's VIP Beta Access");
            response.put("betaBannerSubheading",
                    settings.getBetaBannerSubheading() != null ? settings.getBetaBannerSubheading() : "Get Full Aspirant Pro Access starting at ₹49/month!");
            response.put("betaTier1Offer",
                    settings.getBetaTier1Offer() != null ? settings.getBetaTier1Offer() : "⚡ 1-Month Founder Pass — Save 75%!");
            response.put("betaTier2Offer",
                    settings.getBetaTier2Offer() != null ? settings.getBetaTier2Offer() : "🔥 3-Month Sprint Pass — Save 70%!");
            response.put("betaTier3Offer",
                    settings.getBetaTier3Offer() != null ? settings.getBetaTier3Offer() : "🔥 6-Month Season Pass — Save 75%!");

            response.put("tier1",
                    Map.of("price", settings.getTier1PriceInr(), "duration", settings.getTier1DurationMonths(), "offer",
                            settings.getTier1SpecialOffer() != null ? settings.getTier1SpecialOffer() : ""));
            response.put("tier2",
                    Map.of("price", settings.getTier2PriceInr(), "duration", settings.getTier2DurationMonths(), "offer",
                            settings.getTier2SpecialOffer() != null ? settings.getTier2SpecialOffer() : ""));
            response.put("tier3",
                    Map.of("price", settings.getTier3PriceInr(), "duration", settings.getTier3DurationMonths(), "offer",
                            settings.getTier3SpecialOffer() != null ? settings.getTier3SpecialOffer() : ""));
        } else {
            response.put("betaUpiId", "airgate@upi");
            response.put("betaQrImageUrl", "");
            response.put("betaSpotsRemaining", 100);
            response.put("betaTier1Price", new BigDecimal("49.00"));
            response.put("betaTier2Price", new BigDecimal("149.00"));
            response.put("betaTier3Price", new BigDecimal("249.00"));
            response.put("betaBannerHeading", "⚡ Limited Founder's VIP Beta Access");
            response.put("betaBannerSubheading", "Get Full Aspirant Pro Access starting at ₹49/month!");
            response.put("betaTier1Offer", "⚡ 1-Month Founder Pass — Save 75%!");
            response.put("betaTier2Offer", "🔥 3-Month Sprint Pass — Save 70%!");
            response.put("betaTier3Offer", "🔥 6-Month Season Pass — Save 75%!");
            response.put("tier1",
                    Map.of("price", BigDecimal.valueOf(99.00), "duration", 1, "offer", "Best for quick revisions"));
            response.put("tier2",
                    Map.of("price", BigDecimal.valueOf(249.00), "duration", 3, "offer", "Save 15% - Most Popular"));
            response.put("tier3",
                    Map.of("price", BigDecimal.valueOf(449.00), "duration", 6, "offer", "Save 25% - Complete Prep"));
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/create-order")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createOrder(
            @RequestParam("duration") int durationMonths,
            @RequestParam(name = "couponCode", required = false) String couponCode,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        // Dynamically fetch pricing configuration from settings using BigDecimal
        BigDecimal amountInRupees = BigDecimal.valueOf(99.00);
        try {
            com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
            if (settings != null) {
                Integer t1Dur = settings.getTier1DurationMonths();
                Integer t2Dur = settings.getTier2DurationMonths();
                Integer t3Dur = settings.getTier3DurationMonths();

                if (durationMonths == 1 || (t1Dur != null && durationMonths == t1Dur)) {
                    amountInRupees = settings.getTier1PriceInr() != null ? settings.getTier1PriceInr()
                            : BigDecimal.valueOf(99.00);
                } else if (durationMonths == 3 || (t2Dur != null && durationMonths == t2Dur)) {
                    amountInRupees = settings.getTier2PriceInr() != null ? settings.getTier2PriceInr()
                            : BigDecimal.valueOf(249.00);
                } else if (durationMonths == 6 || (t3Dur != null && durationMonths == t3Dur)) {
                    amountInRupees = settings.getTier3PriceInr() != null ? settings.getTier3PriceInr()
                            : BigDecimal.valueOf(449.00);
                } else {
                    // Fallback proportional calculation using BigDecimal division
                    BigDecimal t1Price = settings.getTier1PriceInr() != null ? settings.getTier1PriceInr()
                            : BigDecimal.valueOf(99.00);
                    int baseDuration = (t1Dur != null && t1Dur > 0) ? t1Dur : 1;
                    amountInRupees = t1Price
                            .divide(BigDecimal.valueOf(baseDuration), 2, RoundingMode.HALF_UP)
                            .multiply(BigDecimal.valueOf(durationMonths));
                }
            } else {
                if (durationMonths == 3)
                    amountInRupees = BigDecimal.valueOf(249.00);
                else if (durationMonths == 6)
                    amountInRupees = BigDecimal.valueOf(449.00);
            }
        } catch (Exception e) {
            if (durationMonths == 3)
                amountInRupees = BigDecimal.valueOf(249.00);
            else if (durationMonths == 6)
                amountInRupees = BigDecimal.valueOf(449.00);
        }

        // Apply Coupon Discount if couponCode provided
        if (couponCode != null && !couponCode.isBlank()) {
            try {
                com.pyq.platform.dto.CouponValidateRequest vReq = new com.pyq.platform.dto.CouponValidateRequest();
                vReq.setCode(couponCode.trim());
                vReq.setOriginalPrice(amountInRupees);
                com.pyq.platform.dto.CouponValidateResponse vRes = couponService.validateCoupon(vReq, user.getId());
                if (vRes != null && vRes.isValid() && vRes.getFinalPrice() != null) {
                    amountInRupees = vRes.getFinalPrice();
                }
            } catch (Exception cEx) {
                log.warn("Failed to apply coupon [{}] to order creation: {}", couponCode, cEx.getMessage());
            }
        }

        long amountInPaise = amountInRupees.multiply(BigDecimal.valueOf(100)).longValue();

        // Sandbox check: if Razorpay keys are not configured, return a mock order
        if (keyId == null || keyId.isBlank() || keyId.equals("placeholder")) {
            String mockOrderId = "mock_order_" + System.currentTimeMillis();

            Payment payment = Payment.builder()
                    .user(user)
                    .orderId(mockOrderId)
                    .amount(amountInRupees)
                    .currency("INR")
                    .status("CREATED")
                    .durationMonths(durationMonths)
                    .build();
            paymentRepository.save(payment);

            return ResponseEntity.ok(Map.of(
                    "orderId", mockOrderId,
                    "amount", amountInPaise,
                    "currency", "INR",
                    "keyId", "sandbox_key",
                    "isMock", true));
        }

        try {
            // Call Razorpay API to create an order
            String url = "https://api.razorpay.com/v1/orders";
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            String auth = keyId + ":" + keySecret;
            String encodedAuth = Base64.getEncoder().encodeToString(auth.getBytes());
            headers.set("Authorization", "Basic " + encodedAuth);

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("amount", amountInPaise);
            requestBody.put("currency", "INR");
            requestBody.put("receipt", "receipt_" + System.currentTimeMillis());

            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);
            ResponseEntity<Map> response = restTemplate.exchange(url, HttpMethod.POST, entity, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                String razorpayOrderId = (String) response.getBody().get("id");

                Payment payment = Payment.builder()
                        .user(user)
                        .orderId(razorpayOrderId)
                        .amount(amountInRupees)
                        .currency("INR")
                        .status("CREATED")
                        .durationMonths(durationMonths)
                        .build();
                paymentRepository.save(payment);

                return ResponseEntity.ok(Map.of(
                        "orderId", razorpayOrderId,
                        "amount", amountInPaise,
                        "currency", "INR",
                        "keyId", keyId,
                        "isMock", false));
            } else {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Failed to create order with Razorpay gateway"));
            }
        } catch (Exception e) {
            log.error("Razorpay order creation error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Error contacting payment gateway: " + e.getMessage()));
        }
    }

    @PostMapping("/verify")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> verifyPayment(
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        String orderId = payload.get("razorpayOrderId");
        String paymentId = payload.get("razorpayPaymentId");
        String signature = payload.get("razorpaySignature");

        Optional<Payment> paymentOpt = paymentRepository.findByOrderId(orderId);
        if (paymentOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Order not found"));
        }

        Payment payment = paymentOpt.get();

        // ── Idempotency guard ─────────────────────────────────────────────────
        // Protects against double-submit / network retries calling verifyPayment twice.
        if ("SUCCESS".equals(payment.getStatus())) {
            log.info("Payment {} already verified for user {}. Returning idempotent response.", orderId,
                    userDetails.getId());
            return ResponseEntity.ok(Map.of("success", true, "message", "Payment already verified successfully."));
        }
        // ─────────────────────────────────────────────────────────────────────

        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        // 1. Sandbox Verification (Allowed ONLY if Razorpay keyId is not configured)
        if (orderId.startsWith("mock_order_")) {
            if (keyId != null && !keyId.isBlank() && !keyId.equals("placeholder")) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN)
                        .body(Map.of("error", "Mock payments are disabled in production environment."));
            }

            payment.setPaymentId("mock_pay_" + System.currentTimeMillis());
            payment.setSignature("mock_sig_" + System.currentTimeMillis());
            payment.setStatus("SUCCESS");
            paymentRepository.save(payment);

            upgradeUserPremium(user, payment);
            return ResponseEntity.ok(Map.of("success", true, "message", "Sandbox payment simulated successfully"));
        }

        // 2. Real Razorpay Verification
        try {
            String signatureData = orderId + "|" + paymentId;
            String calculatedSignature = calculateHmacSha256(signatureData, keySecret);

            if (calculatedSignature.equals(signature)) {
                payment.setPaymentId(paymentId);
                payment.setSignature(signature);
                payment.setStatus("SUCCESS");
                paymentRepository.save(payment);

                upgradeUserPremium(user, payment);
                return ResponseEntity.ok(Map.of("success", true, "message", "Payment verified successfully"));
            } else {
                payment.setStatus("FAILED");
                paymentRepository.save(payment);
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "Invalid payment signature verification failed"));
            }
        } catch (Exception e) {
            log.error("Payment verification error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Signature verification error: " + e.getMessage()));
        }
    }

    private void upgradeUserPremium(User user, Payment payment) {
        int duration = (payment != null && payment.getDurationMonths() != null) ? payment.getDurationMonths() : 1;
        String planName = "Aspirant Pro Pass";
        BigDecimal amount = (payment != null && payment.getAmount() != null) ? payment.getAmount() : new BigDecimal("49.00");
        upgradeUserPremium(user, duration, planName, amount);
        if (payment != null) {
            try {
                emailService.sendPaymentSuccessEmail(user, payment);
            } catch (Exception e) {
                log.warn("Failed to send payment confirmation email to {}: {}", user.getEmail(), e.getMessage());
            }
        }
    }

    private void upgradeUserPremium(User user, int durationMonths, String planName, BigDecimal amount) {
        user.setIsPremium(true);
        int validDuration = durationMonths > 0 ? durationMonths : 1;
        LocalDateTime currentExpiry = user.getPremiumExpiresAt();
        LocalDateTime newExpiry = (currentExpiry != null && currentExpiry.isAfter(LocalDateTime.now()))
                ? currentExpiry.plusMonths(validDuration)
                : LocalDateTime.now().plusMonths(validDuration);
        user.setPremiumExpiresAt(newExpiry);
        userRepository.save(user);
        log.info("✅ Upgraded user {} to premium until {} ({} months)", user.getUsername(), newExpiry, validDuration);

        try {
            emailService.sendPaymentApprovalConfirmationEmail(user, planName != null ? planName : "Aspirant Pro Pass", validDuration, amount != null ? amount : new BigDecimal("49.00"), newExpiry);
        } catch (Exception e) {
            log.warn("Failed to send payment confirmation email to {}: {}", user.getEmail(), e.getMessage());
        }
    }

    @PostMapping("/submit-upi")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submitUpiPayment(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        User user = userRepository.findById(userDetails.getId()).orElseThrow();
        String planType = body.containsKey("planType") && body.get("planType") != null 
                ? body.get("planType").toString() : "MONTHLY_49";
        
        int durationMonths = 1;
        if (body.containsKey("durationMonths") && body.get("durationMonths") != null) {
            try {
                durationMonths = Integer.parseInt(body.get("durationMonths").toString().replaceAll("[^0-9]", ""));
            } catch (Exception ignored) {}
        }

        BigDecimal amount = new BigDecimal("49.00");
        if (body.containsKey("amount") && body.get("amount") != null) {
            try {
                String amtStr = body.get("amount").toString().replaceAll("[^0-9.]", "");
                if (!amtStr.isBlank()) {
                    amount = new BigDecimal(amtStr);
                }
            } catch (Exception ignored) {}
        }

        String utrNumber = body.get("utrNumber") != null ? body.get("utrNumber").toString() : null;
        String screenshotUrl = body.get("screenshotUrl") != null ? body.get("screenshotUrl").toString() : "";

        if (utrNumber == null || utrNumber.trim().isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "12-digit UTR/Transaction reference number is required."));
        }

        String cleanUtr = utrNumber.trim().replaceAll("\\s+", "");
        if (cleanUtr.length() < 4) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Invalid UTR reference length. Please enter a valid transaction reference."));
        }

        Optional<com.pyq.platform.entity.PaymentVerification> existingOpt = paymentVerificationRepository.findByUtrNumber(cleanUtr);
        if (existingOpt.isPresent()) {
            com.pyq.platform.entity.PaymentVerification existing = existingOpt.get();
            if (existing.getUser() != null && existing.getUser().getId().equals(user.getId())) {
                return ResponseEntity.ok(Map.of(
                        "message", "Your payment verification request for UTR " + cleanUtr + " is already recorded and under review!",
                        "id", existing.getId(),
                        "status", existing.getStatus().name()));
            } else {
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "This UTR number has already been submitted by another user."));
            }
        }

        com.pyq.platform.entity.PaymentVerification pv = com.pyq.platform.entity.PaymentVerification.builder()
                .user(user)
                .planType(planType)
                .durationMonths(durationMonths)
                .amount(amount)
                .utrNumber(cleanUtr)
                .screenshotUrl(screenshotUrl.trim())
                .status(com.pyq.platform.entity.PaymentVerification.Status.PENDING)
                .build();

        paymentVerificationRepository.save(pv);
        log.info("📩 User {} submitted VIP Beta UPI verification with UTR {}", user.getUsername(), cleanUtr);

        // Send instant admin email alert
        try {
            emailService.sendAdminUpiPaymentNotification(pv, user);
        } catch (Exception e) {
            log.warn("Failed to dispatch admin notification email for UTR {}: {}", cleanUtr, e.getMessage());
        }

        return ResponseEntity.ok(Map.of(
                "message", "Payment proof submitted successfully! Verification usually takes 5-15 minutes.",
                "id", pv.getId(),
                "status", pv.getStatus().name()));
    }

    @GetMapping("/my-verification")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMyVerification(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        Optional<com.pyq.platform.entity.PaymentVerification> pvOpt = paymentVerificationRepository
                .findFirstByUserIdAndStatusOrderByCreatedAtDesc(
                        userDetails.getId(), com.pyq.platform.entity.PaymentVerification.Status.PENDING);
        if (pvOpt.isEmpty()) {
            List<com.pyq.platform.entity.PaymentVerification> list = paymentVerificationRepository
                    .findByUserIdOrderByCreatedAtDesc(userDetails.getId());
            pvOpt = list.stream().findFirst();
        }
        if (pvOpt.isEmpty()) {
            return ResponseEntity.ok(Map.of("hasSubmitted", false));
        }
        com.pyq.platform.entity.PaymentVerification pv = pvOpt.get();
        return ResponseEntity.ok(Map.of(
                "hasSubmitted", true,
                "id", pv.getId(),
                "planType", pv.getPlanType(),
                "amount", pv.getAmount(),
                "utrNumber", pv.getUtrNumber(),
                "status", pv.getStatus().name(),
                "adminNotes", pv.getAdminNotes() != null ? pv.getAdminNotes() : "",
                "createdAt", pv.getCreatedAt()));
    }

    @GetMapping("/admin/verifications")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getAdminVerifications(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "20") int size) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        org.springframework.data.domain.Page<com.pyq.platform.entity.PaymentVerification> pvPage;
        try {
            pvPage = paymentVerificationRepository.findAllOrderedByPendingFirst(pageable);
        } catch (Exception e) {
            log.warn("findAllOrderedByPendingFirst failed, falling back to standard order: {}", e.getMessage());
            pvPage = paymentVerificationRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        List<Map<String, Object>> content = pvPage.getContent().stream().map(pv -> {
            Map<String, Object> m = new HashMap<>();
            m.put("id", pv.getId());
            m.put("userId", pv.getUser() != null ? pv.getUser().getId() : null);
            m.put("username", pv.getUser() != null ? pv.getUser().getUsername() : "Unknown");
            m.put("email", pv.getUser() != null ? pv.getUser().getEmail() : "");
            m.put("planType", pv.getPlanType());
            m.put("durationMonths", pv.getDurationMonths());
            m.put("amount", pv.getAmount());
            m.put("utrNumber", pv.getUtrNumber());
            m.put("screenshotUrl", pv.getScreenshotUrl() != null ? pv.getScreenshotUrl() : "");
            m.put("status", pv.getStatus().name());
            m.put("adminNotes", pv.getAdminNotes() != null ? pv.getAdminNotes() : "");
            m.put("createdAt", pv.getCreatedAt());
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(Map.of(
                "content", content,
                "totalPages", pvPage.getTotalPages(),
                "totalElements", pvPage.getTotalElements(),
                "currentPage", page));
    }

    @PostMapping("/admin/verifications/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> approveVerification(
            @PathVariable("id") Long id,
            @RequestBody(required = false) Map<String, Object> body) {

        com.pyq.platform.entity.PaymentVerification pv = paymentVerificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Verification request not found with ID: " + id));

        boolean alreadyApproved = (pv.getStatus() == com.pyq.platform.entity.PaymentVerification.Status.APPROVED);

        pv.setStatus(com.pyq.platform.entity.PaymentVerification.Status.APPROVED);
        if (body != null && body.containsKey("notes") && body.get("notes") != null) {
            pv.setAdminNotes(body.get("notes").toString());
        }
        paymentVerificationRepository.save(pv);

        try {
            if (pv.getUser() != null && pv.getUser().getId() != null) {
                User user = userRepository.findById(pv.getUser().getId()).orElse(pv.getUser());
                int durationMonths = pv.getDurationMonths() != null ? pv.getDurationMonths() : 1;
                upgradeUserPremium(user, durationMonths, pv.getPlanType(), pv.getAmount());
            }
        } catch (Exception e) {
            log.error("Error activating user premium for payment ID {}: {}", id, e.getMessage(), e);
        }

        if (!alreadyApproved) {
            try {
                com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
                if (settings != null && settings.getBetaSpotsRemaining() != null && settings.getBetaSpotsRemaining() > 0) {
                    settings.setBetaSpotsRemaining(settings.getBetaSpotsRemaining() - 1);
                    systemSettingsRepository.save(settings);
                }
            } catch (Exception e) {
                log.warn("Failed to decrement beta spots remaining for payment ID {}: {}", id, e.getMessage());
            }
        }

        log.info("✅ Admin approved VIP Beta payment ID {} ({} months)", id, pv.getDurationMonths());

        return ResponseEntity
                .ok(Map.of("message", "VIP Beta payment approved and Premium access activated successfully!"));
    }

    @PostMapping("/admin/verifications/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> rejectVerification(
            @PathVariable("id") Long id,
            @RequestBody(required = false) Map<String, Object> body) {

        com.pyq.platform.entity.PaymentVerification pv = paymentVerificationRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Verification request not found with ID: " + id));

        if (pv.getStatus() == com.pyq.platform.entity.PaymentVerification.Status.REJECTED) {
            return ResponseEntity.ok(Map.of("message", "Payment verification request rejected. User notified via email."));
        }

        pv.setStatus(com.pyq.platform.entity.PaymentVerification.Status.REJECTED);
        String notes = "Transaction UTR or payment proof could not be verified.";
        if (body != null && body.containsKey("notes") && body.get("notes") != null && !body.get("notes").toString().isBlank()) {
            notes = body.get("notes").toString().trim();
        }
        pv.setAdminNotes(notes);
        paymentVerificationRepository.save(pv);

        try {
            User user = pv.getUser();
            if (user != null) {
                emailService.sendPaymentRejectionNoticeEmail(user, pv.getUtrNumber(), notes);
            }
        } catch (Exception e) {
            log.warn("Failed to send payment rejection email: {}", e.getMessage());
        }

        log.info("❌ Admin rejected VIP Beta payment ID {}", id);

        return ResponseEntity.ok(Map.of("message", "Payment verification request rejected. User notified via email."));
    }

    @PostMapping("/admin/settings/beta")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateBetaSettings(@RequestBody Map<String, Object> body) {
        com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1)
                .orElseGet(() -> com.pyq.platform.entity.SystemSettings.builder().id(1).build());

        if (body.containsKey("betaPaymentEnabled")) {
            settings.setBetaPaymentEnabled(Boolean.parseBoolean(body.get("betaPaymentEnabled").toString()));
        }
        if (body.containsKey("betaUpiId")) {
            settings.setBetaUpiId(body.get("betaUpiId").toString().trim());
        }
        if (body.containsKey("betaQrImageUrl")) {
            settings.setBetaQrImageUrl(body.get("betaQrImageUrl").toString().trim());
        }
        if (body.containsKey("betaSpotsRemaining")) {
            settings.setBetaSpotsRemaining(Integer.parseInt(body.get("betaSpotsRemaining").toString()));
        }
        if (body.containsKey("betaTier1Price")) {
            settings.setBetaTier1Price(new BigDecimal(body.get("betaTier1Price").toString()));
        }
        if (body.containsKey("betaTier2Price")) {
            settings.setBetaTier2Price(new BigDecimal(body.get("betaTier2Price").toString()));
        }
        if (body.containsKey("betaTier3Price")) {
            settings.setBetaTier3Price(new BigDecimal(body.get("betaTier3Price").toString()));
        }
        if (body.containsKey("betaBannerHeading")) {
            settings.setBetaBannerHeading(body.get("betaBannerHeading").toString().trim());
        }
        if (body.containsKey("betaBannerSubheading")) {
            settings.setBetaBannerSubheading(body.get("betaBannerSubheading").toString().trim());
        }
        if (body.containsKey("betaTier1Offer")) {
            settings.setBetaTier1Offer(body.get("betaTier1Offer").toString().trim());
        }
        if (body.containsKey("betaTier2Offer")) {
            settings.setBetaTier2Offer(body.get("betaTier2Offer").toString().trim());
        }
        if (body.containsKey("betaTier3Offer")) {
            settings.setBetaTier3Offer(body.get("betaTier3Offer").toString().trim());
        }

        systemSettingsRepository.save(settings);
        log.info("⚙️ Admin updated VIP Beta Payment Settings in DB.");

        return ResponseEntity.ok(Map.of("message", "VIP Beta Payment settings updated successfully!"));
    }

    private String calculateHmacSha256(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] rawHmac = mac.doFinal(data.getBytes());
        StringBuilder hexString = new StringBuilder();
        for (byte b : rawHmac) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1)
                hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
