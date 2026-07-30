package com.pyq.platform.controller;

import com.pyq.platform.entity.BugReport;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.BugReportRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class BugReportController {

    private final BugReportRepository bugReportRepository;
    private final UserRepository userRepository;

    public BugReportController(BugReportRepository bugReportRepository, UserRepository userRepository) {
        this.bugReportRepository = bugReportRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/bugs")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submitBug(
            @RequestBody BugReport bugReport,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        User user = userRepository.findById(userDetails.getId()).orElse(null);
        bugReport.setUser(user);
        bugReport.setStatus("OPEN");
        
        BugReport saved = bugReportRepository.save(bugReport);
        
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @GetMapping("/admin/bugs")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public ResponseEntity<?> getAllBugs() {
        List<BugReport> list = bugReportRepository.findAllByOrderByCreatedAtDesc();
        // Map to display cleaner details
        List<Map<String, Object>> mapped = list.stream().map(b -> {
            Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", b.getId());
            m.put("title", b.getTitle());
            m.put("description", b.getDescription());
            m.put("pageUrl", b.getPageUrl());
            m.put("status", b.getStatus());
            m.put("createdAt", b.getCreatedAt());
            String username = "Anonymous";
            try {
                if (b.getUser() != null && org.hibernate.Hibernate.isInitialized(b.getUser())) {
                    username = b.getUser().getUsername();
                } else if (b.getUser() != null) {
                    username = b.getUser().getUsername();
                }
            } catch (Exception ignored) {}
            m.put("reportedBy", username);
            return m;
        }).toList();
        return ResponseEntity.ok(mapped);
    }

    @PutMapping("/admin/bugs/{id}/resolve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> resolveBug(@PathVariable("id") Long id) {
        BugReport bug = bugReportRepository.findById(id).orElse(null);
        if (bug == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Bug report not found"));
        }
        bug.setStatus("RESOLVED");
        bugReportRepository.save(bug);
        return ResponseEntity.ok(Map.of("success", true, "message", "Bug report marked as RESOLVED"));
    }
}
