package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.entity.Question;
import com.pyq.platform.entity.QuestionReport;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.repository.QuestionReportRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@Transactional
public class QuestionReportController {

    private final QuestionReportRepository reportRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public QuestionReportController(QuestionReportRepository reportRepository,
                                    QuestionRepository questionRepository,
                                    UserRepository userRepository) {
        this.reportRepository = reportRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    // Submit a report for a question
    @PostMapping("/questions/{id}/report")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> reportQuestion(
            @PathVariable("id") Long id,
            @RequestBody Map<String, String> payload,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        String reason = payload.get("reason");
        if (reason == null || reason.trim().isEmpty()) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Reason for report is required!"));
        }

        String description = payload.get("description");
        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        QuestionReport report = QuestionReport.builder()
                .question(questionOpt.get())
                .reportedBy(user)
                .reason(reason.trim())
                .description(description != null ? description.trim() : "")
                .status("PENDING")
                .build();

        reportRepository.save(report);
        return ResponseEntity.ok(new MessageResponse("Report submitted successfully! The administration will review it."));
    }

    // Get all pending reports (Admin/Editor only)
    @GetMapping("/admin/reports")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> getPendingReports() {
        List<QuestionReport> reports = reportRepository.findByStatusOrderByCreatedAtDesc("PENDING");
        return ResponseEntity.ok(formatReportList(reports));
    }

    // Get full report history (ALL, RESOLVED, DISCARDED, PENDING) (Admin/Editor only)
    @GetMapping("/admin/reports/history")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> getReportHistory() {
        List<QuestionReport> reports = reportRepository.findAllByOrderByCreatedAtDesc();
        return ResponseEntity.ok(formatReportList(reports));
    }

    private List<Map<String, Object>> formatReportList(List<QuestionReport> reports) {
        return reports.stream().map(r -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", r.getId());
            map.put("questionId", r.getQuestion().getId());
            map.put("questionText", r.getQuestion().getText());
            map.put("subjectName", r.getQuestion() != null && r.getQuestion().getSubject() != null ? r.getQuestion().getSubject().getName() : "General CS");
            map.put("reportedBy", r.getReportedBy() != null ? r.getReportedBy().getUsername() : "Anonymous");
            map.put("reason", r.getReason());
            map.put("description", r.getDescription());
            map.put("status", r.getStatus());
            map.put("createdAt", r.getCreatedAt());
            return map;
        }).collect(Collectors.toList());
    }

    // Resolve a report (Admin/Editor only)
    @PostMapping("/admin/reports/{id}/resolve")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> resolveReport(@PathVariable("id") Long id) {
        Optional<QuestionReport> reportOpt = reportRepository.findById(id);
        if (reportOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Report not found!"));
        }

        QuestionReport report = reportOpt.get();
        report.setStatus("RESOLVED");
        reportRepository.save(report);

        return ResponseEntity.ok(new MessageResponse("Report resolved successfully!"));
    }

    // Purge reported question (Admin/Editor only)
    @PostMapping("/admin/reports/{id}/purge-question")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> purgeReportedQuestion(@PathVariable("id") Long id) {
        Optional<QuestionReport> reportOpt = reportRepository.findById(id);
        if (reportOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Report not found!"));
        }

        QuestionReport report = reportOpt.get();
        Question q = report.getQuestion();
        
        report.setStatus("QUESTION_PURGED");
        reportRepository.save(report);

        if (q != null) {
            questionRepository.delete(q);
        }

        return ResponseEntity.ok(new MessageResponse("Reported question purged completely from database!"));
    }
}
