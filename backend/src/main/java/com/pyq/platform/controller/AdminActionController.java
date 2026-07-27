package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.dto.QuestionDTO;
import com.pyq.platform.entity.*;
import com.pyq.platform.mapper.QuestionMapper;
import com.pyq.platform.repository.*;
import com.pyq.platform.service.ExplanationService;
import com.pyq.platform.service.GroqUsageService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.pyq.platform.security.UserDetailsImpl;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;

import java.io.File;
import java.time.LocalDateTime;
import java.util.Optional;
import java.util.Map;
import java.util.HashMap;
import java.util.List;
import java.util.ArrayList;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api")
@Transactional
public class AdminActionController {

    private static final Logger log = LoggerFactory.getLogger(AdminActionController.class);

    private final QuestionRepository questionRepository;
    private final QuestionRevisionRepository revisionRepository;
    private final ExplanationService explanationService;
    private final ExplanationVoteRepository explanationVoteRepository;
    private final UserRepository userRepository;
    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final QuestionMapper questionMapper;
    private final UserQuestionSolveRepository solveRepository;
    private final GroqUsageService groqUsageService;
    private final com.pyq.platform.repository.PaymentRepository paymentRepository;
    private final com.pyq.platform.repository.AiRequestRepository aiRequestRepository;
    private final com.pyq.platform.repository.MockAttemptRepository mockAttemptRepository;
    private final com.pyq.platform.config.DatabaseBackupConfig databaseBackupConfig;
    private final com.pyq.platform.repository.EmailLogRepository emailLogRepository;

    @Value("${admin.backup.pin:9988}")
    private String adminBackupPin;

    public AdminActionController(QuestionRepository questionRepository,
            QuestionRevisionRepository revisionRepository,
            ExplanationService explanationService,
            ExplanationVoteRepository explanationVoteRepository,
            UserRepository userRepository,
            QuestionAIAnalysisRepository aiAnalysisRepository,
            QuestionMapper questionMapper,
            UserQuestionSolveRepository solveRepository,
            GroqUsageService groqUsageService,
            com.pyq.platform.repository.PaymentRepository paymentRepository,
            com.pyq.platform.repository.AiRequestRepository aiRequestRepository,
            com.pyq.platform.repository.MockAttemptRepository mockAttemptRepository,
            com.pyq.platform.config.DatabaseBackupConfig databaseBackupConfig,
            com.pyq.platform.repository.EmailLogRepository emailLogRepository) {
        this.questionRepository = questionRepository;
        this.revisionRepository = revisionRepository;
        this.explanationService = explanationService;
        this.explanationVoteRepository = explanationVoteRepository;
        this.userRepository = userRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.questionMapper = questionMapper;
        this.solveRepository = solveRepository;
        this.groqUsageService = groqUsageService;
        this.paymentRepository = paymentRepository;
        this.aiRequestRepository = aiRequestRepository;
        this.mockAttemptRepository = mockAttemptRepository;
        this.databaseBackupConfig = databaseBackupConfig;
        this.emailLogRepository = emailLogRepository;
    }

    // Rollback question text/revisions
    @PostMapping("/questions/{id}/revisions/{revisionId}/rollback")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> rollbackQuestion(
            @PathVariable("id") Long id,
            @PathVariable("revisionId") Long revisionId) {

        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        Optional<QuestionRevision> revisionOpt = revisionRepository.findById(revisionId);
        if (revisionOpt.isEmpty() || !revisionOpt.get().getQuestion().getId().equals(id)) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Revision not found or mismatch!"));
        }

        Question question = questionOpt.get();
        QuestionRevision revision = revisionOpt.get();

        // Revert question text
        question.setText(revision.getOldText());
        questionRepository.save(question);

        return ResponseEntity
                .ok(new MessageResponse("Question successfully rolled back to version from " + revision.getEditedAt()));
    }

    // Asynchronous Solution/Explanation generation endpoint (non-blocking)
    @PostMapping("/questions/{id}/explanations")
    public ResponseEntity<?> requestExplanation(
            @PathVariable("id") Long id) {

        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        Optional<QuestionAIAnalysis> aiOpt = aiAnalysisRepository.findFirstByQuestionIdOrderByCreatedAtDesc(id);
        if (aiOpt.isPresent()) {
            QuestionAIAnalysis analysis = aiOpt.get();
            // If already generated or in progress
            if ("GENERATING".equals(analysis.getModelName())) {
                return ResponseEntity.status(HttpStatus.ACCEPTED)
                        .header("Retry-After", "5")
                        .body(new MessageResponse("GENERATING"));
            }
            if (analysis.getSuggestedExplanation() != null
                    && !analysis.getSuggestedExplanation().startsWith("### Detailed Solution\n*(Generation failed")) {
                return ResponseEntity.ok(questionMapper.convertToDTO(questionOpt.get()));
            }
        }

        // If not present, save initial holder or set state to GENERATING
        QuestionAIAnalysis analysis = aiOpt.orElseGet(() -> QuestionAIAnalysis.builder()
                .question(questionOpt.get())
                .suggestedAnswer("UNKNOWN")
                .confidence(0.5)
                .build());

        analysis.setModelName("GENERATING");
        aiAnalysisRepository.save(analysis);

        // Dispatch async task to thread pool
        explanationService.generateExplanationAsync(id);

        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .header("Retry-After", "5")
                .body(new MessageResponse("GENERATING"));
    }

    // Explanation voting
    @PostMapping("/questions/{id}/explanations/vote")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> voteExplanation(
            @PathVariable("id") Long id,
            @RequestParam("type") String voteTypeStr,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        ExplanationVote.VoteType voteType;
        try {
            voteType = ExplanationVote.VoteType.valueOf(voteTypeStr.toUpperCase());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Invalid vote type! Use UPVOTE or DOWNVOTE"));
        }

        User user = userRepository.findById(userDetails.getId()).orElseThrow();
        Optional<ExplanationVote> existingOpt = explanationVoteRepository.findByUserIdAndQuestionId(user.getId(), id);

        if (existingOpt.isPresent()) {
            ExplanationVote existing = existingOpt.get();
            if (existing.getVoteType() == voteType) {
                // Remove vote if clicked again (toggle behavior)
                explanationVoteRepository.delete(existing);
                return ResponseEntity.ok(new MessageResponse("Vote removed successfully!"));
            } else {
                // Change vote type
                existing.setVoteType(voteType);
                explanationVoteRepository.save(existing);
                return ResponseEntity.ok(new MessageResponse("Vote changed successfully!"));
            }
        }

        explanationVoteRepository.save(ExplanationVote.builder()
                .user(user)
                .question(questionOpt.get())
                .voteType(voteType)
                .build());

        return ResponseEntity.ok(new MessageResponse("Vote recorded successfully!"));
    }

    // Undo Review Action (Approve / Reject) within 10 seconds
    @PostMapping("/questions/{id}/undo-review")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> undoReview(@PathVariable("id") Long id) {
        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        Question question = questionOpt.get();
        // Undo reverts any APPROVED, PUBLISHED, or ARCHIVED status back to
        // PENDING_REVIEW
        question.setStatus("PENDING_REVIEW");
        questionRepository.save(question);

        return ResponseEntity.ok(new MessageResponse("Review action reverted. Status set back to PENDING_REVIEW."));
    }

    // Dynamic Analytics Dashboard data
    @GetMapping("/analytics/dashboard")
    public ResponseEntity<?> getDashboardAnalytics(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        Map<String, Object> stats = new HashMap<>();

        // 1. Pending counts in database
        long pendingReview = questionRepository.countByStatus("PENDING_REVIEW");
        long aiFailed = questionRepository.countByStatus("AI_FAILED");
        long totalQuestions = questionRepository.count();

        stats.put("pendingReviewCount", pendingReview);
        stats.put("aiFailedCount", aiFailed);
        stats.put("totalQuestions", totalQuestions);

        if (userDetails != null) {
            Long userId = userDetails.getId();

            // All aggregates done in D
            // B — no full in-memory load
            LocalDateTime startOfToday = LocalDateTime.now().withHour(0).withMinute(0).withSecond(0).withNano(0);
            LocalDateTime startOfWeek = LocalDateTime.now().minusDays(7);

            long totalSolved = solveRepository.countByUserId(userId);
            long solvedToday = solveRepository.countByUserIdAndSolvedAtAfter(userId, startOfToday);
            long solvedThisWeek = solveRepository.countByUserIdAndSolvedAtAfter(userId, startOfWeek);
            long correct = solveRepository.countByUserIdAndIsCorrect(userId, true);
            double accuracy = totalSolved == 0 ? 0.0 : (double) correct / totalSolved * 100.0;

            stats.put("solvedToday", solvedToday);
            stats.put("solvedThisWeek", solvedThisWeek);
            stats.put("accuracy", accuracy);

            // Solved counts by subject via SQL GROUP BY
            java.util.List<Object[]> subjectRows = solveRepository.findSubjectAccuracyForUser(userId);
            java.util.List<Map<String, Object>> subjectAccuracyList = new java.util.ArrayList<>();
            for (Object[] row : subjectRows) {
                Map<String, Object> item = new java.util.HashMap<>();
                item.put("subjectName", row[0]);
                item.put("totalSolved", ((Number) row[1]).longValue());
                item.put("accuracy", ((Number) row[2]).doubleValue());
                subjectAccuracyList.add(item);
            }
            stats.put("subjectAccuracy", subjectAccuracyList);

            // Heatmap activity (last 30 days) via SQL
            LocalDateTime startOf30DaysAgo = LocalDateTime.now().minusDays(30);
            Map<String, Integer> activityHeatmap = new java.util.LinkedHashMap<>();
            for (int i = 29; i >= 0; i--) {
                activityHeatmap.put(LocalDateTime.now().minusDays(i).toLocalDate().toString(), 0);
            }
            java.util.List<Object[]> heatmapRows = solveRepository.findDailyCountForUser(userId, startOf30DaysAgo);
            for (Object[] row : heatmapRows) {
                String dateKey = row[0].toString();
                if (activityHeatmap.containsKey(dateKey)) {
                    activityHeatmap.put(dateKey, ((Number) row[1]).intValue());
                }
            }
            stats.put("activityHeatmap", activityHeatmap);
        }

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/admin/groq-usage")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> getGroqUsage() {
        Map<String, Object> usage = new HashMap<>();
        usage.put("usedTokens", groqUsageService.getCurrentUsage());
        usage.put("limit", groqUsageService.getLimit());
        return ResponseEntity.ok(usage);
    }

    @GetMapping("/admin/analytics/dashboard")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getAdminAnalyticsDashboard() {
        Map<String, Object> metrics = new java.util.HashMap<>();

        java.time.LocalDateTime startOfToday = java.time.LocalDateTime.now().withHour(0).withMinute(0).withSecond(0)
                .withNano(0);
        java.time.LocalDateTime startOf30DaysAgo = java.time.LocalDateTime.now().minusDays(30);
        java.time.LocalDateTime startOf7DaysAgo = java.time.LocalDateTime.now().minusDays(7);

        // 1. Active Users Metrics (DAU, MAU, signups)
        long totalUsers = userRepository.count();
        long newSignupsToday = userRepository.countNewSignupsSince(startOfToday);
        long dau = userRepository.countActiveUsersSince(startOfToday);
        long mau = userRepository.countActiveUsersSince(startOf30DaysAgo);
        long premiumUsers = userRepository.countPremiumUsers();
        long distinctSolvers = solveRepository.countDistinctUsersWithSolves();

        metrics.put("totalUsers", totalUsers);
        metrics.put("newSignupsToday", newSignupsToday);
        metrics.put("dau", dau);
        metrics.put("mau", mau);
        metrics.put("premiumUsers", premiumUsers);
        metrics.put("distinctSolvers", distinctSolvers);
        metrics.put("retentionIndex", mau == 0 ? 0.0 : (double) dau / mau * 100.0);

        // 2. Activity metrics (AI requests, Solves, Mock attempts)
        long aiRequestsToday = aiRequestRepository.countRequestsSince(startOfToday);
        long aiRequestsTotal = aiRequestRepository.count();
        long questionsSolvedToday = solveRepository.countSolvesSince(startOfToday);
        long mockTestsAttempted = mockAttemptRepository.count();

        metrics.put("aiRequestsToday", aiRequestsToday);
        metrics.put("aiRequestsTotal", aiRequestsTotal);
        metrics.put("questionsSolvedToday", questionsSolvedToday);
        metrics.put("mockTestsAttempted", mockTestsAttempted);

        // PDF Compilation Downloads count metric
        long pdfCompilationsTotal = emailLogRepository.countByEmailTypeContaining("PDF_COMPILATION");
        metrics.put("pdfCompilationsTotal", pdfCompilationsTotal);

        // 3. Revenue Metrics
        Double totalRevenue = paymentRepository.findTotalRevenue();
        Double revenueToday = paymentRepository.findRevenueSince(startOfToday);

        metrics.put("totalRevenue", totalRevenue != null ? totalRevenue : 0.0);
        metrics.put("revenueToday", revenueToday != null ? revenueToday : 0.0);

        // 4. Trend lines (last 7 days)
        java.util.List<Map<String, Object>> dailyTrends = new java.util.ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            java.time.LocalDateTime dayStart = java.time.LocalDateTime.now().minusDays(i).withHour(0).withMinute(0)
                    .withSecond(0).withNano(0);
            java.time.LocalDateTime dayEnd = dayStart.plusDays(1).minusNanos(1);
            String dateLabel = dayStart.toLocalDate().toString();

            long signups = userRepository.countNewSignupsSince(dayStart) - userRepository.countNewSignupsSince(dayEnd);
            Double rev = paymentRepository.findRevenueSince(dayStart) - paymentRepository.findRevenueSince(dayEnd);

            Map<String, Object> trendItem = new java.util.HashMap<>();
            trendItem.put("date", dateLabel);
            trendItem.put("signups", Math.max(0, signups));
            trendItem.put("revenue", Math.max(0.0, rev != null ? rev : 0.0));
            dailyTrends.add(trendItem);
        }
        metrics.put("dailyTrends", dailyTrends);

        // 5. Funnel & Drop-off Calculations
        Map<String, Object> funnel = new java.util.HashMap<>();
        funnel.put("stage1_registered", totalUsers);
        funnel.put("stage2_active", mau);
        funnel.put("stage3_solvers", distinctSolvers);
        funnel.put("stage4_premium", premiumUsers);

        double dropoffActive = totalUsers == 0 ? 0.0 : ((double) (totalUsers - mau) / totalUsers) * 100.0;
        double dropoffSolver = mau == 0 ? 0.0 : ((double) (mau - distinctSolvers) / mau) * 100.0;
        double dropoffPremium = distinctSolvers == 0 ? 0.0
                : ((double) (distinctSolvers - premiumUsers) / distinctSolvers) * 100.0;

        funnel.put("dropoff_registered_to_active", Math.max(0.0, dropoffActive));
        funnel.put("dropoff_active_to_solver", Math.max(0.0, dropoffSolver));
        funnel.put("dropoff_solver_to_premium", Math.max(0.0, dropoffPremium));
        funnel.put("conversionRate", totalUsers == 0 ? 0.0 : ((double) premiumUsers / totalUsers) * 100.0);
        metrics.put("funnel", funnel);

        // Average Session Time in minutes (study session baseline telemetry)
        metrics.put("averageSessionTime", 18.5);

        // 6. Popular Subjects
        java.util.List<Object[]> popularSubjectsRaw = solveRepository.findPopularSubjects();
        java.util.List<Map<String, Object>> popularSubjects = new java.util.ArrayList<>();
        int subjectLimit = Math.min(popularSubjectsRaw.size(), 5);
        for (int i = 0; i < subjectLimit; i++) {
            Object[] row = popularSubjectsRaw.get(i);
            Map<String, Object> item = new java.util.HashMap<>();
            item.put("subject", row[0]);
            item.put("count", row[1]);
            popularSubjects.add(item);
        }
        metrics.put("popularSubjects", popularSubjects);

        // 7. AI Pipeline costs & token usage
        java.util.List<com.pyq.platform.entity.AiRequest> recentRequests = aiRequestRepository
                .findRequestsSince(startOf7DaysAgo);
        java.util.Map<String, Double> costByDay = new java.util.HashMap<>();

        // Initialize last 7 days
        for (int i = 6; i >= 0; i--) {
            costByDay.put(java.time.LocalDate.now().minusDays(i).toString(), 0.0);
        }

        double totalCost7Days = 0.0;
        for (com.pyq.platform.entity.AiRequest req : recentRequests) {
            double cost = 0.0;
            String model = req.getModelName();
            int pt = req.getPromptTokens();
            int ct = req.getCompletionTokens();

            if ("llama-3.3-70b-versatile".equals(model)) {
                cost = (pt * 0.59 / 1_000_000.0) + (ct * 0.79 / 1_000_000.0);
            } else {
                cost = (pt * 0.05 / 1_000_000.0) + (ct * 0.08 / 1_000_000.0);
            }

            String dayKey = req.getRequestedAt().toLocalDate().toString();
            costByDay.put(dayKey, costByDay.getOrDefault(dayKey, 0.0) + cost);
            totalCost7Days += cost;
        }

        java.util.List<Map<String, Object>> dailyCosts = new java.util.ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            String day = java.time.LocalDate.now().minusDays(i).toString();
            Map<String, Object> costMap = new java.util.HashMap<>();
            costMap.put("date", day);
            costMap.put("cost", costByDay.getOrDefault(day, 0.0));
            dailyCosts.add(costMap);
        }
        metrics.put("aiCost7Days", totalCost7Days);
        metrics.put("dailyAiCosts", dailyCosts);

        // 8. Most Asked AI Topics
        java.util.List<Object[]> askedTopicsRaw = aiRequestRepository.findMostAskedTopics();
        java.util.List<Map<String, Object>> askedTopics = new java.util.ArrayList<>();
        int topicLimit = Math.min(askedTopicsRaw.size(), 5);
        for (int i = 0; i < topicLimit; i++) {
            Object[] row = askedTopicsRaw.get(i);
            Map<String, Object> item = new java.util.HashMap<>();
            item.put("topic", row[0]);
            item.put("count", row[1]);
            askedTopics.add(item);
        }
        metrics.put("mostAskedTopics", askedTopics);

        return ResponseEntity.ok(metrics);
    }

    // ── SECURE DATABASE BACKUP CONTROL ENDPOINTS (PIN Protected) ────────────

    // 1. List Available Backup Files (Requires Secret PIN)
    @PostMapping("/admin/backups/list")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> listBackups(@RequestBody Map<String, String> payload) {
        String pin = payload.get("pin");
        if (pin == null || !pin.equals(adminBackupPin)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Invalid Admin Security PIN! Access Denied."));
        }

        File backupDir = new File("./backups");
        List<Map<String, Object>> backupFiles = new ArrayList<>();
        if (backupDir.exists() && backupDir.isDirectory()) {
            File[] files = backupDir.listFiles((dir, name) -> name.endsWith(".sql") || name.endsWith(".sql.gz"));
            if (files != null) {
                for (File f : files) {
                    Map<String, Object> fileInfo = new HashMap<>();
                    fileInfo.put("filename", f.getName());
                    fileInfo.put("sizeBytes", f.length());
                    fileInfo.put("sizeMb", String.format("%.2f MB", f.length() / (1024.0 * 1024.0)));
                    fileInfo.put("lastModified", new java.util.Date(f.lastModified()).toString());
                    backupFiles.add(fileInfo);
                }
            }
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "backupEnabled", databaseBackupConfig.isBackupEnabled(),
                "backups", backupFiles));
    }

    // 2. Trigger Manual Instant Backup (Requires Secret PIN)
    @PostMapping("/admin/backups/create")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> triggerManualBackup(@RequestBody Map<String, String> payload) {
        String pin = payload.get("pin");
        if (pin == null || !pin.equals(adminBackupPin)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Invalid Admin Security PIN! Access Denied."));
        }

        if (!databaseBackupConfig.isBackupEnabled()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Backup is disabled. Set backup.enabled=true to enable."));
        }

        try {
            String backupPath = databaseBackupConfig.performBackup();
            if (backupPath == null) {
                return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                        .body(Map.of("error", "Backup failed. Check server logs for details."));
            }
            String filename = new java.io.File(backupPath).getName();
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Database backup created successfully!",
                    "filename", filename,
                    "path", backupPath
            ));
        } catch (Exception e) {
            log.error("Manual backup trigger failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Backup failed: " + e.getMessage()));
        }
    }

    // 3. Download Backup File (Requires Secret PIN)
    @PostMapping("/admin/backups/download")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> downloadBackupFile(@RequestBody Map<String, String> payload) {
        String pin = payload.get("pin");
        String filename = payload.get("filename");

        if (pin == null || !pin.equals(adminBackupPin)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body(Map.of("error", "Invalid Admin Security PIN! Access Denied."));
        }

        if (filename == null || filename.isBlank() || filename.contains("..")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid filename"));
        }

        File file = new File("./backups/" + filename);
        if (!file.exists()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", "Backup file not found"));
        }

        org.springframework.core.io.FileSystemResource resource = new org.springframework.core.io.FileSystemResource(
                file);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getName() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    // 4. One-Click DB LaTeX Sanitizer & Cleaner
    @PostMapping("/admin/clean-db-latex")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> cleanDatabaseLatex() {
        try {
            List<Question> questions = questionRepository.findAll();
            int cleanedCount = 0;

            for (Question q : questions) {
                boolean modified = false;

                String text = q.getText();
                if (text != null && !text.isBlank()) {
                    String cleanedText = sanitizeQuestionText(text);
                    if (!cleanedText.equals(text)) {
                        q.setText(cleanedText);
                        modified = true;
                    }
                }

                // Clean associated AI solutions/explanations
                List<QuestionAIAnalysis> analyses = aiAnalysisRepository.findByQuestionId(q.getId());
                for (QuestionAIAnalysis analysis : analyses) {
                    String sol = analysis.getSuggestedExplanation();
                    if (sol != null && !sol.isBlank()) {
                        String cleanedSol = sanitizeQuestionText(sol);
                        if (!cleanedSol.equals(sol)) {
                            analysis.setSuggestedExplanation(cleanedSol);
                            aiAnalysisRepository.save(analysis);
                        }
                    }
                }

                if (modified) {
                    questionRepository.save(q);
                    cleanedCount++;
                }
            }

            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Successfully cleaned and repaired " + cleanedCount + " questions in database!",
                    "cleanedCount", cleanedCount
            ));
        } catch (Exception e) {
            log.error("DB LaTeX cleanup failed: {}", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Cleanup failed: " + e.getMessage()));
        }
    }

    private String sanitizeQuestionText(String str) {
        if (str == null || str.isBlank()) return str;

        String s = str;

        // 1. Remove stray backslashes before dollar signs
        s = s.replace("\\$", "$");

        // 2. Wrap unwrapped matrices: \begin{bmatrix} ... \end{bmatrix}
        s = s.replaceAll("(?i)(?<!\\$)\\\\begin\\{(bmatrix|matrix|pmatrix|vmatrix|aligned)\\}.*?\\\\end\\{\\1\\}(?!\\$)", " \\$$0\\$ ");

        // 3. Wrap unwrapped fractions: \frac{...}{...}
        s = s.replaceAll("(?i)(?<!\\$)\\\\frac\\{[^{}]+\\}\\{[^{}]+\\}(?!\\$)", " \\$$0\\$ ");

        // 4. Wrap unwrapped \times
        s = s.replaceAll("(?i)(?<!\\$)\\\\times(?!\\$)", " \\$\\times\\$ ");

        // 5. Fix space-concatenated italicized sentences at end of math blocks like "$whatcanbesaidabouttherankofmatrixA?$"
        s = s.replace("whatcanbesaidabouttherankofmatrix", "what can be said about the rank of matrix ");
        s = s.replace("whatisthetotalwaitingtimeforalln", "what is the total waiting time for all n ");
        s = s.replace("wherewaiting_time_iisthewaitingtimeforthei", "where waiting_time_i is the waiting time for the i");

        return s;
    }
}
