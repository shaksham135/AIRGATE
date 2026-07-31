package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.entity.PromoBanner;
import com.pyq.platform.repository.PromoBannerRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class PromoBannerController {

    private final PromoBannerRepository bannerRepository;

    public PromoBannerController(PromoBannerRepository bannerRepository) {
        this.bannerRepository = bannerRepository;
    }

    // Public Endpoint: Fetch active announcement banners for website header
    @GetMapping("/banners/active")
    public ResponseEntity<List<PromoBanner>> getActiveBanners() {
        List<PromoBanner> banners = bannerRepository.findByActiveTrueOrderByPriorityDescCreatedAtDesc();
        return ResponseEntity.ok(banners);
    }

    // Admin: List all banners
    @GetMapping("/admin/banners")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<PromoBanner>> getAllBanners() {
        return ResponseEntity.ok(bannerRepository.findAllByOrderByPriorityDescCreatedAtDesc());
    }

    // Admin: Create announcement banner
    @PostMapping("/admin/banners")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> createBanner(@RequestBody PromoBanner banner) {
        if (banner.getTitle() == null || banner.getTitle().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Banner title cannot be empty."));
        }
        if (banner.getMessage() == null || banner.getMessage().isBlank()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Banner message cannot be empty."));
        }

        if (banner.getCtaText() == null) banner.setCtaText("Claim Offer");
        if (banner.getCtaLink() == null) banner.setCtaLink("/pricing");
        if (banner.getBannerType() == null) banner.setBannerType("HEADER_BAR");
        if (banner.getBgColor() == null) banner.setBgColor("#8b5cf6");
        if (banner.getTextColor() == null) banner.setTextColor("#ffffff");
        if (banner.getActive() == null) banner.setActive(true);
        if (banner.getPriority() == null) banner.setPriority(0);

        PromoBanner saved = bannerRepository.save(banner);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    // Admin: Toggle active status
    @PutMapping("/admin/banners/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> toggleBannerStatus(@PathVariable Long id, @RequestParam boolean active) {
        Optional<PromoBanner> opt = bannerRepository.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Banner not found."));
        }

        PromoBanner banner = opt.get();
        banner.setActive(active);
        bannerRepository.save(banner);
        return ResponseEntity.ok(new MessageResponse("Banner status updated to " + active));
    }

    // Admin: Delete banner
    @DeleteMapping("/admin/banners/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> deleteBanner(@PathVariable Long id) {
        if (!bannerRepository.existsById(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new MessageResponse("Banner not found."));
        }
        bannerRepository.deleteById(id);
        return ResponseEntity.ok(new MessageResponse("Banner deleted successfully."));
    }
}
