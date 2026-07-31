package com.pyq.platform.controller;

import com.pyq.platform.dto.CouponValidateRequest;
import com.pyq.platform.dto.CouponValidateResponse;
import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.entity.Coupon;
import com.pyq.platform.repository.CouponRepository;
import com.pyq.platform.security.UserDetailsImpl;
import com.pyq.platform.service.CouponService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class CouponController {

    private final CouponService couponService;
    private final CouponRepository couponRepository;

    public CouponController(CouponService couponService, CouponRepository couponRepository) {
        this.couponService = couponService;
        this.couponRepository = couponRepository;
    }

    // Public / Authenticated Real-time Validation
    @PostMapping("/coupons/validate")
    public ResponseEntity<CouponValidateResponse> validateCoupon(
            @RequestBody CouponValidateRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        Long userId = userDetails != null ? userDetails.getId() : null;
        CouponValidateResponse response = couponService.validateCoupon(request, userId);
        return ResponseEntity.ok(response);
    }

    // Admin: List all coupons
    @GetMapping("/admin/coupons")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Coupon>> getAllCoupons() {
        return ResponseEntity.ok(couponRepository.findAllByOrderByCreatedAtDesc());
    }

    // Admin: Create custom coupon
    @PostMapping("/admin/coupons")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createCoupon(@RequestBody Coupon coupon) {
        if (coupon.getCode() == null || coupon.getCode().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Coupon code cannot be empty."));
        }

        String cleanCode = coupon.getCode().trim().toUpperCase();
        if (couponRepository.existsByCodeIgnoreCase(cleanCode)) {
            return ResponseEntity.badRequest().body(new MessageResponse("Coupon code '" + cleanCode + "' already exists!"));
        }

        coupon.setCode(cleanCode);
        if (coupon.getDiscountType() == null) coupon.setDiscountType(Coupon.DiscountType.PERCENTAGE);
        if (coupon.getApplicableTier() == null) coupon.setApplicableTier(Coupon.PlanTier.ALL);
        if (coupon.getMaxUses() == null) coupon.setMaxUses(100);
        if (coupon.getCurrentUses() == null) coupon.setCurrentUses(0);
        if (coupon.getMaxUsesPerUser() == null) coupon.setMaxUsesPerUser(1);
        if (coupon.getActive() == null) coupon.setActive(true);

        Coupon saved = couponRepository.save(coupon);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // Admin: Update coupon status/fields
    @PutMapping("/admin/coupons/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> updateCoupon(@PathVariable Long id, @RequestBody Coupon updated) {
        Optional<Coupon> opt = couponRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Coupon not found."));
        }

        Coupon existing = opt.get();
        if (updated.getDiscountValue() != null) existing.setDiscountValue(updated.getDiscountValue());
        if (updated.getDiscountType() != null) existing.setDiscountType(updated.getDiscountType());
        if (updated.getApplicableTier() != null) existing.setApplicableTier(updated.getApplicableTier());
        if (updated.getMaxUses() != null) existing.setMaxUses(updated.getMaxUses());
        if (updated.getMinOrderAmount() != null) existing.setMinOrderAmount(updated.getMinOrderAmount());
        if (updated.getActive() != null) existing.setActive(updated.getActive());
        if (updated.getValidUntil() != null) existing.setValidUntil(updated.getValidUntil());

        Coupon saved = couponRepository.save(existing);
        return ResponseEntity.ok(saved);
    }

    // Admin: Delete coupon
    @DeleteMapping("/admin/coupons/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteCoupon(@PathVariable Long id) {
        if (!couponRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Coupon not found."));
        }
        couponRepository.deleteById(id);
        return ResponseEntity.ok(new MessageResponse("Coupon deleted successfully."));
    }
}
