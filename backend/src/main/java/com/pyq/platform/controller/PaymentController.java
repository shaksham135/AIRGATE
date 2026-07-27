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
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

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
    private final com.pyq.platform.service.EmailService emailService;
    private final RestTemplate restTemplate = new RestTemplate();

    public PaymentController(PaymentRepository paymentRepository, 
                             UserRepository userRepository,
                             com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository,
                             com.pyq.platform.service.EmailService emailService) {
        this.paymentRepository = paymentRepository;
        this.userRepository = userRepository;
        this.systemSettingsRepository = systemSettingsRepository;
        this.emailService = emailService;
    }

    @GetMapping("/pricing")
    public ResponseEntity<?> getPricingTiers() {
        try {
            com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
            if (settings != null) {
                return ResponseEntity.ok(Map.of(
                        "tier1", Map.of("price", settings.getTier1PriceInr(), "duration", settings.getTier1DurationMonths(), "offer", settings.getTier1SpecialOffer() != null ? settings.getTier1SpecialOffer() : ""),
                        "tier2", Map.of("price", settings.getTier2PriceInr(), "duration", settings.getTier2DurationMonths(), "offer", settings.getTier2SpecialOffer() != null ? settings.getTier2SpecialOffer() : ""),
                        "tier3", Map.of("price", settings.getTier3PriceInr(), "duration", settings.getTier3DurationMonths(), "offer", settings.getTier3SpecialOffer() != null ? settings.getTier3SpecialOffer() : "")
                ));
            }
        } catch (Exception e) {
            log.error("Failed to fetch settings pricing: {}", e.getMessage());
        }
        return ResponseEntity.ok(Map.of(
                "tier1", Map.of("price", 99.0, "duration", 1, "offer", "Best for quick revisions"),
                "tier2", Map.of("price", 249.0, "duration", 3, "offer", "Save 15% - Most Popular"),
                "tier3", Map.of("price", 449.0, "duration", 6, "offer", "Save 25% - Complete Prep")
        ));
    }

    @PostMapping("/create-order")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> createOrder(
            @RequestParam("duration") int durationMonths,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        // Dynamically fetch pricing configuration from settings
        double amountInRupees = 99.0;
        try {
            com.pyq.platform.entity.SystemSettings settings = systemSettingsRepository.findById(1).orElse(null);
            if (settings != null) {
                if (durationMonths == 1 || durationMonths == settings.getTier1DurationMonths()) {
                    amountInRupees = settings.getTier1PriceInr();
                } else if (durationMonths == 3 || durationMonths == settings.getTier2DurationMonths()) {
                    amountInRupees = settings.getTier2PriceInr();
                } else if (durationMonths == 6 || durationMonths == settings.getTier3DurationMonths()) {
                    amountInRupees = settings.getTier3PriceInr();
                } else {
                    // fallback proportional calculation
                    amountInRupees = (settings.getTier1PriceInr() / settings.getTier1DurationMonths()) * durationMonths;
                }
            } else {
                if (durationMonths == 3) amountInRupees = 249.0;
                else if (durationMonths == 6) amountInRupees = 449.0;
            }
        } catch (Exception e) {
            if (durationMonths == 3) amountInRupees = 249.0;
            else if (durationMonths == 6) amountInRupees = 449.0;
        }

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
                    "amount", amountInRupees * 100, // paise
                    "currency", "INR",
                    "keyId", "sandbox_key",
                    "isMock", true
            ));
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
            requestBody.put("amount", (int) (amountInRupees * 100)); // amount in paise
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
                        "amount", amountInRupees * 100,
                        "currency", "INR",
                        "keyId", keyId,
                        "isMock", false
                ));
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
            log.info("Payment {} already verified for user {}. Returning idempotent response.", orderId, userDetails.getId());
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
                return ResponseEntity.badRequest().body(Map.of("error", "Invalid payment signature verification failed"));
            }
        } catch (Exception e) {
            log.error("Payment verification error: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Signature verification error: " + e.getMessage()));
        }
    }

    private void upgradeUserPremium(User user, Payment payment) {
        user.setIsPremium(true);
        int durationMonths = payment != null ? payment.getDurationMonths() : 1;
        LocalDateTime currentExpiry = user.getPremiumExpiresAt();
        LocalDateTime newExpiry = (currentExpiry != null && currentExpiry.isAfter(LocalDateTime.now()))
                ? currentExpiry.plusMonths(durationMonths)
                : LocalDateTime.now().plusMonths(durationMonths);
        user.setPremiumExpiresAt(newExpiry);
        userRepository.save(user);
        log.info("Upgraded user {} to premium until {}", user.getUsername(), newExpiry);

        if (payment != null) {
            try {
                emailService.sendPaymentSuccessEmail(user, payment);
            } catch (Exception e) {
                log.warn("Failed to send payment confirmation email to {}: {}", user.getEmail(), e.getMessage());
            }
        }
    }

    private String calculateHmacSha256(String data, String secret) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(), "HmacSHA256");
        mac.init(secretKeySpec);
        byte[] rawHmac = mac.doFinal(data.getBytes());
        StringBuilder hexString = new StringBuilder();
        for (byte b : rawHmac) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) hexString.append('0');
            hexString.append(hex);
        }
        return hexString.toString();
    }
}
