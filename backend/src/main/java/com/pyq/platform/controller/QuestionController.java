package com.pyq.platform.controller;

import com.pyq.platform.dto.*;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.BookmarkRepository;
import com.pyq.platform.repository.QuestionAIAnalysisRepository;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.repository.SubjectRepository;
import com.pyq.platform.repository.TopicRepository;
import com.pyq.platform.repository.UserQuestionSolveRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import com.pyq.platform.service.AIClassificationService;
import com.pyq.platform.service.CloudinaryService;
import com.pyq.platform.service.QuestionService;
import com.pyq.platform.mapper.QuestionMapper;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;
import java.awt.image.BufferedImage;
import java.io.*;
import java.net.URL;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.stream.Collectors;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import javax.imageio.ImageIO;
import com.pyq.platform.util.SubjectSlugUtils;
import com.pyq.platform.service.SystemSettingService;
import com.pyq.platform.repository.MockAttemptAnswerRepository;

@RestController
@RequestMapping("/api/questions")
@CrossOrigin(origins = "*", maxAge = 3600)
@Slf4j
public class QuestionController {

    private final QuestionService questionService;
    private final QuestionRepository questionRepository;
    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;
    private final UserRepository userRepository;
    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final CloudinaryService cloudinaryService;
    private final QuestionMapper questionMapper;
    private final BookmarkRepository bookmarkRepository;
    private final UserQuestionSolveRepository solveRepository;
    private final AIClassificationService aiClassificationService;
    private final SystemSettingService systemSettingService;
    private final MockAttemptAnswerRepository mockAttemptAnswerRepository;

    public QuestionController(QuestionService questionService, QuestionRepository questionRepository,
            SubjectRepository subjectRepository,
            TopicRepository topicRepository, UserRepository userRepository,
            QuestionAIAnalysisRepository aiAnalysisRepository,
            CloudinaryService cloudinaryService,
            QuestionMapper questionMapper,
            BookmarkRepository bookmarkRepository,
            UserQuestionSolveRepository solveRepository,
            AIClassificationService aiClassificationService,
            SystemSettingService systemSettingService,
            MockAttemptAnswerRepository mockAttemptAnswerRepository) {
        this.questionService = questionService;
        this.questionRepository = questionRepository;
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.userRepository = userRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.cloudinaryService = cloudinaryService;
        this.questionMapper = questionMapper;
        this.bookmarkRepository = bookmarkRepository;
        this.solveRepository = solveRepository;
        this.aiClassificationService = aiClassificationService;
        this.systemSettingService = systemSettingService;
        this.mockAttemptAnswerRepository = mockAttemptAnswerRepository;
    }

    // Public search with filters (anonymous access mapped in SecurityConfig)
    @GetMapping
    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "questions", key = "T(java.util.Objects).hash(#query, #subjectId, #topicId, #year, #questionType, #tagName, #solvedStatus, #bookmarked, #status, #sourceType, #page, #size, #userDetails != null ? #userDetails.getId() : 0)")
    public ResponseEntity<PageDTO<QuestionDTO>> searchQuestions(
            @RequestParam(name = "query", required = false) String query,
            @RequestParam(name = "subjectId", required = false) Long subjectId,
            @RequestParam(name = "topicId", required = false) Long topicId,
            @RequestParam(name = "year", required = false) Integer year,
            @RequestParam(name = "type", required = false) String questionType,
            @RequestParam(name = "tag", required = false) String tagName,
            @RequestParam(name = "solvedStatus", required = false) String solvedStatus,
            @RequestParam(name = "bookmarked", required = false) Boolean bookmarked,
            @RequestParam(name = "status", required = false, defaultValue = "APPROVED") String status,
            @RequestParam(name = "sourceType", required = false) String sourceType,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Pageable pageable = PageRequest.of(page, size);
        Long userId = (userDetails != null) ? userDetails.getId() : null;

        Page<Question> questionsPage = questionService.searchQuestions(query, subjectId, topicId, year, questionType,
                tagName, status, sourceType, userId, solvedStatus, bookmarked, pageable);

        List<QuestionDTO> dtos = questionsPage.getContent().stream()
                .map(this::convertToDTOFast)
                .collect(Collectors.toList());

        PageDTO<QuestionDTO> pageDTO = PageDTO.<QuestionDTO>builder()
                .content(dtos)
                .pageNumber(questionsPage.getNumber())
                .pageSize(questionsPage.getSize())
                .totalElements(questionsPage.getTotalElements())
                .totalPages(questionsPage.getTotalPages())
                .last(questionsPage.isLast())
                .build();

        return ResponseEntity.ok(pageDTO);
    }

    // Public detail view (Cached for instant sub-5ms response)
    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "questionDetail", key = "#id")
    public ResponseEntity<?> getQuestionById(@PathVariable("id") Long id) {
        Optional<Question> questionOpt = questionService.getQuestionById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found with ID: " + id));
        }
        return ResponseEntity.ok(convertToDTO(questionOpt.get()));
    }

    @GetMapping("/resolve/gate/{branch}/{year}/{setStr}/{qNumStr}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> resolveGateQuestion(
            @PathVariable("branch") String branch,
            @PathVariable("year") Integer year,
            @PathVariable("setStr") String setStr,
            @PathVariable("qNumStr") String qNumStr) {

        int setNum = 1;
        try {
            setNum = Integer.parseInt(setStr.toLowerCase().replace("set-", "").replace("set", "").trim());
        } catch (Exception ignored) {
        }

        int qNum = 1;
        try {
            qNum = Integer.parseInt(qNumStr.toLowerCase().replace("q", "").trim());
        } catch (Exception ignored) {
        }

        // Priority 1: Check by exact branch + year + paperSet + questionNumber
        Optional<Question> qOpt = questionRepository.findFirstByBranchAndYearAndPaperSetAndQuestionNumber(
                branch.toLowerCase().trim(), year, setNum, qNum);

        // Priority 2: Check by direct Primary Key ID
        if (qOpt.isEmpty()) {
            qOpt = questionRepository.findById((long) qNum);
        }

        // Priority 3: Check by questionNumber
        if (qOpt.isEmpty()) {
            qOpt = questionRepository.findFirstByQuestionNumber(qNum);
        }

        if (qOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found for GATE " + branch + " " + year + " Set-"
                            + setNum + " Q" + qNum));
        }

        return ResponseEntity.ok(convertToDTO(qOpt.get()));
    }

    @GetMapping("/resolve/practice/{subjectSlug}/{qNumStr}")
    @Transactional(readOnly = true)
    public ResponseEntity<?> resolvePracticeQuestion(
            @PathVariable("subjectSlug") String subjectSlug,
            @PathVariable("qNumStr") String qNumStr) {

        int qNum = 1;
        try {
            qNum = Integer.parseInt(qNumStr.toLowerCase().replace("q", "").trim());
        } catch (Exception ignored) {
        }

        // Priority 1: Check by subject + questionNumber
        String canonicalSubjectName = SubjectSlugUtils.toCanonicalSubjectName(subjectSlug);
        Optional<Question> qOpt = Optional.empty();
        if (canonicalSubjectName != null) {
            Optional<Subject> subOpt = subjectRepository.findByName(canonicalSubjectName);
            if (subOpt.isPresent()) {
                qOpt = questionRepository.findFirstBySubjectIdAndQuestionNumber(subOpt.get().getId(), qNum);
            }
        }

        // Priority 2: Check by direct Primary Key ID
        if (qOpt.isEmpty()) {
            qOpt = questionRepository.findById((long) qNum);
        }

        // Priority 3: Check by questionNumber
        if (qOpt.isEmpty()) {
            qOpt = questionRepository.findFirstByQuestionNumber(qNum);
        }

        if (qOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Practice question not found for " + subjectSlug + " Q" + qNum));
        }

        return ResponseEntity.ok(convertToDTO(qOpt.get()));
    }

    @GetMapping("/{id}/redirect-url")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getRedirectUrl(@PathVariable("id") Long id) {
        Optional<Question> qOpt = questionRepository.findById(id);
        if (qOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found with ID: " + id));
        }
        QuestionDTO dto = convertToDTO(qOpt.get());
        return ResponseEntity.ok(Map.of("redirectUrl", dto.getSeoUrl(), "id", id));
    }

    @GetMapping("/{id}/user-status")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getQuestionUserStatus(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        if (userDetails == null) {
            return ResponseEntity.ok(Map.of(
                    "isBookmarked", false,
                    "isSolved", false,
                    "isCorrect", false,
                    "selectedOption", ""));
        }

        Long userId = userDetails.getId();
        boolean isBookmarked = bookmarkRepository.existsByUserIdAndQuestionId(userId, id);
        Optional<com.pyq.platform.entity.UserQuestionSolve> solveOpt = solveRepository.findByUserIdAndQuestionId(userId,
                id);

        boolean isSolved = solveOpt.isPresent();
        boolean isCorrect = solveOpt.map(com.pyq.platform.entity.UserQuestionSolve::getIsCorrect).orElse(false);
        String selectedOption = solveOpt.map(com.pyq.platform.entity.UserQuestionSolve::getSelectedOption).orElse("");

        Map<String, Object> res = new HashMap<>();
        res.put("isBookmarked", isBookmarked);
        res.put("isSolved", isSolved);
        res.put("isCorrect", isCorrect);
        res.put("selectedOption", selectedOption != null ? selectedOption : "");
        return ResponseEntity.ok(res);
    }

    @GetMapping("/stats")
    @org.springframework.cache.annotation.Cacheable(value = "stats")
    public ResponseEntity<?> getStats() {
        long approved = questionRepository.countOfficialPyqsByStatus("APPROVED");
        long pending = questionRepository.countOfficialPyqsByStatus("PENDING");
        if (pending == 0) {
            pending = questionRepository.countOfficialPyqsByStatus("PENDING_REVIEW");
        }
        long total = questionRepository.countOfficialPyqsTotal();

        java.util.Map<String, Long> stats = new java.util.HashMap<>();
        stats.put("totalApproved", approved);
        stats.put("totalPending", pending);
        stats.put("totalQuestions", total);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/background-stats")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> getBackgroundStats() {
        long pending = aiAnalysisRepository.countPendingApprovedByModelName("fast-parse");
        long completed = aiAnalysisRepository.countByModelName("llama-3.1-8b-comprehensive");
        long fallback = aiAnalysisRepository.countByModelName("fallback");
        long total = aiAnalysisRepository.count();

        java.util.Map<String, Object> stats = new java.util.HashMap<>();
        stats.put("pendingSolutions", pending);
        stats.put("completedSolutions", completed);
        stats.put("fallbackSolutions", fallback);
        stats.put("totalSolutions", total);

        return ResponseEntity.ok(stats);
    }

    @GetMapping("/years")
    public ResponseEntity<List<Integer>> getDistinctYears() {
        return ResponseEntity.ok(questionService.getDistinctYears());
    }

    // Admin/Editor Create Question
    @PostMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> createQuestion(@Valid @RequestBody CreateQuestionRequest request) {
        Subject subject = subjectRepository.findById(request.getSubjectId())
                .orElse(null);
        Topic topic = topicRepository.findById(request.getTopicId())
                .orElse(null);

        if (subject == null || topic == null) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Invalid Subject ID or Topic ID provided!"));
        }

        Question question = Question.builder()
                .text(request.getText())
                .questionType(request.getQuestionType())
                .marks(request.getMarks())
                .negativeMarks(request.getNegativeMarks() != null ? Math.abs(request.getNegativeMarks()) : 0.0)
                .year(request.getYear())
                .questionNumber(request.getQuestionNumber())
                .subject(subject)
                .topic(topic)
                .pdfSourceName(request.getPdfSourceName())
                .pdfSourcePath(request.getPdfSourcePath())
                .pdfPageNumber(request.getPdfPageNumber())
                .imagePath(request.getImagePath())
                .status(request.getStatus())
                .build();

        try {
            Question saved = questionService.createQuestion(question, request.getOptions(), request.getTags());

            // Save initial AI Analysis with user-defined answer/explanation
            String ans = request.getAiSuggestedAnswer() != null && !request.getAiSuggestedAnswer().trim().isEmpty()
                    ? request.getAiSuggestedAnswer()
                    : "A";
            String exp = request.getAiSuggestedExplanation() != null
                    && !request.getAiSuggestedExplanation().trim().isEmpty()
                            ? request.getAiSuggestedExplanation()
                            : "### Detailed Solution\nThe correct answer is **" + ans + "**.";
            aiAnalysisRepository.save(QuestionAIAnalysis.builder()
                    .question(saved)
                    .suggestedAnswer(ans)
                    .suggestedExplanation(exp)
                    .confidence(1.0)
                    .modelName("manual-entry")
                    .build());

            return ResponseEntity.status(HttpStatus.CREATED).body(convertToDTO(saved));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT)
                    .body(new MessageResponse(e.getMessage()));
        }
    }

    // Admin/Editor Update Question
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    @Transactional
    @org.springframework.cache.annotation.CacheEvict(value = { "questions", "practiceQuestions", "similarQuestions",
            "questionDetail", "years", "publicMeta" }, allEntries = true)
    public ResponseEntity<?> updateQuestion(
            @PathVariable("id") Long id,
            @Valid @RequestBody CreateQuestionRequest request,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Subject subject = subjectRepository.findById(request.getSubjectId())
                .orElse(null);
        Topic topic = topicRepository.findById(request.getTopicId())
                .orElse(null);

        if (subject == null || topic == null) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Invalid Subject ID or Topic ID provided!"));
        }

        User editor = (userDetails != null && userDetails.getId() != null)
                ? userRepository.findById(userDetails.getId()).orElse(null)
                : null;

        Question updatedData = Question.builder()
                .text(request.getText())
                .questionType(request.getQuestionType())
                .marks(request.getMarks() != null ? request.getMarks() : 1)
                .negativeMarks(request.getNegativeMarks() != null ? Math.abs(request.getNegativeMarks()) : 0.0)
                .year(request.getYear() != null ? request.getYear() : 2026)
                .questionNumber(request.getQuestionNumber())
                .subject(subject)
                .topic(topic)
                .pdfSourceName(request.getPdfSourceName() != null ? request.getPdfSourceName() : "Manual Entry")
                .pdfSourcePath(request.getPdfSourcePath() != null ? request.getPdfSourcePath() : "Manual Entry")
                .pdfPageNumber(request.getPdfPageNumber() != null ? request.getPdfPageNumber() : 1)
                .imagePath(request.getImagePath())
                .status(request.getStatus() != null ? request.getStatus() : "APPROVED")
                .isCommunityVerified(false)
                .build();

        try {
            Question updated = questionService.updateQuestion(id, updatedData, request.getOptions(), request.getTags(),
                    editor);

            // Update or create QuestionAIAnalysis record
            Optional<QuestionAIAnalysis> aiOpt = aiAnalysisRepository
                    .findFirstByQuestionIdOrderByCreatedAtDesc(updated.getId());

            String reqAns = request.getAiSuggestedAnswer();
            String reqExp = request.getAiSuggestedExplanation();

            if (aiOpt.isPresent()) {
                QuestionAIAnalysis ai = aiOpt.get();
                if (reqAns != null && !reqAns.trim().isEmpty()) {
                    ai.setSuggestedAnswer(reqAns);
                }
                if (reqExp != null && !reqExp.trim().isEmpty()) {
                    ai.setSuggestedExplanation(reqExp);
                }
                if (ai.getSuggestedAnswer() == null || ai.getSuggestedAnswer().trim().isEmpty()) {
                    ai.setSuggestedAnswer("A");
                }
                if (ai.getModelName() == null) {
                    ai.setModelName("manual-entry");
                }
                if (ai.getConfidence() == null) {
                    ai.setConfidence(1.0);
                }
                aiAnalysisRepository.save(ai);
            } else {
                String ans = (reqAns != null && !reqAns.trim().isEmpty()) ? reqAns : "A";
                String exp = (reqExp != null && !reqExp.trim().isEmpty()) ? reqExp
                        : "### Detailed Solution\nThe correct answer is **" + ans + "**.";
                aiAnalysisRepository.save(QuestionAIAnalysis.builder()
                        .question(updated)
                        .suggestedAnswer(ans)
                        .suggestedExplanation(exp)
                        .confidence(1.0)
                        .modelName("manual-entry")
                        .build());
            }

            return ResponseEntity.ok(convertToDTO(updated));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse(e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to update question with ID {}: ", id, e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error updating question: " + e.getMessage()));
        }
    }

    // Admin/Editor Delete Question
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> deleteQuestion(@PathVariable("id") Long id) {
        try {
            questionService.deleteQuestion(id);
            return ResponseEntity.ok(new MessageResponse("Question deleted successfully!"));
        } catch (Exception e) {
            log.error("Failed to delete question ID {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error deleting question: " + e.getMessage()));
        }
    }

    // Render the specific PDF source page of this question as a PNG image on the
    @GetMapping("/{id}/page-image")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<byte[]> getQuestionPageImage(@PathVariable("id") Long id) {
        Optional<Question> questionOpt = questionService.getQuestionById(id);
        if (questionOpt.isEmpty())
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();

        Question question = questionOpt.get();
        String pdfPath = question.getPdfSourcePath();
        Integer pageNum = question.getPdfPageNumber();
        if (pdfPath == null || pageNum == null)
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();

        File tempFile = null;
        try {
            ResolvedPdf resolved = resolvePdfFile(pdfPath);
            if (resolved == null)
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            tempFile = resolved.tempFile;

            try (PDDocument document = PDDocument.load(resolved.pdfFile)) {
                if (pageNum < 1 || pageNum > document.getNumberOfPages())
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();

                PDFRenderer renderer = new PDFRenderer(document);
                BufferedImage img = renderer.renderImageWithDPI(pageNum - 1, 150);

                ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ImageIO.write(img, "PNG", baos);

                org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
                headers.setContentType(org.springframework.http.MediaType.IMAGE_PNG);
                return new ResponseEntity<>(baos.toByteArray(), headers, HttpStatus.OK);
            }
        } catch (Exception e) {
            log.error("Failed to render PDF page image for question {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } finally {
            if (tempFile != null && tempFile.exists())
                tempFile.delete();
        }
    }

    @GetMapping("/{id}/page-text")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<String> getQuestionPageText(@PathVariable("id") Long id) {
        Optional<Question> questionOpt = questionService.getQuestionById(id);
        if (questionOpt.isEmpty())
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();

        Question question = questionOpt.get();
        String pdfPath = question.getPdfSourcePath();
        Integer pageNum = question.getPdfPageNumber();
        if (pdfPath == null || pageNum == null)
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();

        File tempFile = null;
        try {
            ResolvedPdf resolved = resolvePdfFile(pdfPath);
            if (resolved == null)
                return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
            tempFile = resolved.tempFile;

            try (PDDocument document = PDDocument.load(resolved.pdfFile)) {
                if (pageNum < 1 || pageNum > document.getNumberOfPages())
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();

                PDFTextStripper stripper = new PDFTextStripper();
                stripper.setStartPage(pageNum);
                stripper.setEndPage(pageNum);
                return ResponseEntity.ok(stripper.getText(document));
            }
        } catch (Exception e) {
            log.error("Failed to extract PDF page text for question {}: {}", id, e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        } finally {
            if (tempFile != null && tempFile.exists())
                tempFile.delete();
        }
    }

    // ── Internal helper ────────────────────────────────────────────────────────

    /**
     * Holds a resolved PDF file handle plus an optional temp file to delete after
     * use.
     */
    private record ResolvedPdf(File pdfFile, File tempFile) {
    }

    /**
     * Resolves a PDF path (URL or local filesystem) into a concrete {@link File}.
     * Returns {@code null} if the file cannot be found anywhere.
     */
    private ResolvedPdf resolvePdfFile(String pdfPath) throws IOException {
        if (pdfPath.startsWith("http://") || pdfPath.startsWith("https://")) {
            File tempFile = File.createTempFile("pdf_temp_", ".pdf");
            tempFile.deleteOnExit();
            try (InputStream in = new URL(pdfPath).openStream()) {
                Files.copy(in, tempFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }
            return new ResolvedPdf(tempFile, tempFile);
        }

        // Try multiple local paths in priority order
        String filename = new File(pdfPath).getName();
        File[] candidates = {
                new File(pdfPath),
                new File("backend/" + pdfPath),
                new File("uploads/pdfs/" + filename),
                new File("backend/uploads/pdfs/" + filename)
        };
        for (File candidate : candidates) {
            if (candidate.exists())
                return new ResolvedPdf(candidate, null);
        }
        return null;
    }

    @PostMapping("/{id}/image")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> uploadQuestionImage(
            @PathVariable("id") Long id,
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {

        Optional<Question> questionOpt = questionService.getQuestionById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found with ID: " + id));
        }

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: File is empty!"));
        }

        try {
            String imagePath;
            if (cloudinaryService.isConfigured()) {
                imagePath = cloudinaryService.uploadMultipartFile(file, "images");
                if (imagePath == null) {
                    throw new java.io.IOException("Failed to upload image to Cloudinary");
                }
            } else {
                // Save file in uploads/images/
                String originalName = file.getOriginalFilename();
                String uniqueName = UUID.randomUUID().toString().substring(0, 8) + "_" + originalName;
                java.io.File destFile = new java.io.File("uploads/images/" + uniqueName).getAbsoluteFile();
                destFile.getParentFile().mkdirs();
                file.transferTo(destFile);
                imagePath = "/uploads/images/" + uniqueName;
            }

            Question question = questionOpt.get();
            question.setImagePath(imagePath);
            questionService.saveQuestion(question);

            return ResponseEntity.ok(new MessageResponse(imagePath));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error uploading image: " + e.getMessage()));
        }
    }

    @PostMapping("/upload-image")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> uploadGeneralImage(
            @RequestParam("file") org.springframework.web.multipart.MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: File is empty!"));
        }

        try {
            String imagePath;
            if (cloudinaryService.isConfigured()) {
                imagePath = cloudinaryService.uploadMultipartFile(file, "images");
                if (imagePath == null) {
                    throw new java.io.IOException("Failed to upload image to Cloudinary");
                }
            } else {
                String originalName = file.getOriginalFilename();
                String uniqueName = java.util.UUID.randomUUID().toString().substring(0, 8) + "_" + originalName;
                java.io.File destFile = new java.io.File("uploads/images/" + uniqueName).getAbsoluteFile();
                destFile.getParentFile().mkdirs();
                file.transferTo(destFile);
                imagePath = "/uploads/images/" + uniqueName;
            }
            return ResponseEntity.ok(new MessageResponse(imagePath));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error uploading image: " + e.getMessage()));
        }
    }

    @PostMapping("/upload-multiple-images")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> uploadMultipleImages(
            @RequestParam("files") org.springframework.web.multipart.MultipartFile[] files) {
        if (files == null || files.length == 0) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: No files provided!"));
        }

        List<String> uploadedUrls = new ArrayList<>();
        try {
            for (org.springframework.web.multipart.MultipartFile file : files) {
                if (file.isEmpty())
                    continue;
                String imagePath;
                if (cloudinaryService.isConfigured()) {
                    imagePath = cloudinaryService.uploadMultipartFile(file, "images");
                    if (imagePath == null) {
                        throw new java.io.IOException("Failed to upload image to Cloudinary");
                    }
                } else {
                    String originalName = file.getOriginalFilename();
                    String uniqueName = java.util.UUID.randomUUID().toString().substring(0, 8) + "_" + originalName;
                    java.io.File destFile = new java.io.File("uploads/images/" + uniqueName).getAbsoluteFile();
                    destFile.getParentFile().mkdirs();
                    file.transferTo(destFile);
                    imagePath = "/uploads/images/" + uniqueName;
                }
                uploadedUrls.add(imagePath);
            }

            String joined = String.join(",", uploadedUrls);
            Map<String, Object> res = new HashMap<>();
            res.put("message", joined);
            res.put("imagePath", joined);
            res.put("urls", uploadedUrls);
            return ResponseEntity.ok(res);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("Error uploading images: " + e.getMessage()));
        }
    }

    private QuestionDTO convertToDTO(Question question) {
        return questionMapper.convertToDTO(question);
    }

    private QuestionDTO convertToDTOFast(Question question) {
        return questionMapper.convertToDTOFast(question);
    }

    @GetMapping("/simulator")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getSimulatorExam(
            @RequestParam(value = "mode", defaultValue = "standard") String mode,
            @org.springframework.security.core.annotation.AuthenticationPrincipal UserDetailsImpl userDetails) {

        long startTime = System.currentTimeMillis();

        // 1. Retrieve attempted question IDs for this user if logged in (from both Mock
        // Tests & Practice Solves)
        Set<Long> attemptedSet = new HashSet<>();
        if (userDetails != null && userDetails.getId() != null) {
            try {
                List<Long> mockAttempted = mockAttemptAnswerRepository
                        .findAttemptedQuestionIdsByUserId(userDetails.getId());
                if (mockAttempted != null) {
                    attemptedSet.addAll(mockAttempted);
                }
                List<Long> practiceSolved = solveRepository.findSolvedQuestionIdsByUserId(userDetails.getId());
                if (practiceSolved != null) {
                    attemptedSet.addAll(practiceSolved);
                }
            } catch (Exception e) {
                log.warn("Failed to fetch attempted questions for user {}", userDetails.getId(), e);
            }
        }

        List<QuestionDTO> selected = new ArrayList<>();
        Set<Long> selectedIds = new HashSet<>();

        boolean isStandardPyqMode = "standard".equalsIgnoreCase(mode);
        boolean isHybridMode = "hybrid".equalsIgnoreCase(mode);

        List<Question> aptPool;
        List<Question> techPool;

        if (isStandardPyqMode) {
            // Mode 1: 100% Official PYQs ONLY (No practice/AI questions allowed!)
            aptPool = questionRepository.findRandomOfficialPyqAptitudeCandidates(60);
            techPool = questionRepository.findRandomOfficialPyqTechnicalCandidates(180);
        } else if (isHybridMode) {
            // Mode 2: Smart Hybrid Mock (70% Fresh Practice + 30% Official PYQs)
            aptPool = new ArrayList<>(questionRepository.findRandomFreshPracticeAptitudeCandidates(45));
            aptPool.addAll(questionRepository.findRandomOfficialPyqAptitudeCandidates(15));

            techPool = new ArrayList<>(questionRepository.findRandomFreshPracticeTechnicalCandidates(130));
            techPool.addAll(questionRepository.findRandomOfficialPyqTechnicalCandidates(50));
        } else {
            aptPool = questionRepository.findRandomAptitudeCandidates(60);
            techPool = questionRepository.findRandomTechnicalCandidates(180);
        }

        // Unsolved Priority Filter
        List<Question> aptUnsolved = aptPool.stream().filter(q -> !attemptedSet.contains(q.getId()))
                .collect(Collectors.toList());
        List<Question> finalAptPool = aptUnsolved.size() >= 15 ? aptUnsolved : aptPool;

        List<Question> techUnsolved = techPool.stream().filter(q -> !attemptedSet.contains(q.getId()))
                .collect(Collectors.toList());
        List<Question> finalTechPool = techUnsolved.size() >= 50 ? techUnsolved : techPool;

        // ── SECTION 1: General Aptitude (Target: Exactly 15 Questions) ──
        List<Question> apt1 = finalAptPool.stream().filter(q -> q.getMarks() != null && q.getMarks() == 1).distinct()
                .collect(Collectors.toList());
        List<Question> apt2 = finalAptPool.stream().filter(q -> q.getMarks() != null && q.getMarks() == 2).distinct()
                .collect(Collectors.toList());

        int aptDrawn1 = 0;
        for (Question q : apt1) {
            if (aptDrawn1 >= 7)
                break;
            if (selectedIds.add(q.getId())) {
                aptDrawn1++;
            }
        }
        int aptDrawn2 = 0;
        for (Question q : apt2) {
            if (aptDrawn2 >= 8)
                break;
            if (selectedIds.add(q.getId())) {
                aptDrawn2++;
            }
        }
        // Fill remaining Aptitude slots up to 15
        for (Question q : finalAptPool) {
            if (selectedIds.size() >= 15)
                break;
            selectedIds.add(q.getId());
        }

        // ── SECTION 2: Computer Science & IT (Target: Exactly 50 Questions = Total 65) ──
        List<Question> tech1 = finalTechPool.stream().filter(q -> q.getMarks() != null && q.getMarks() == 1).distinct()
                .collect(Collectors.toList());
        List<Question> tech2 = finalTechPool.stream().filter(q -> q.getMarks() != null && q.getMarks() == 2).distinct()
                .collect(Collectors.toList());

        int techDrawn1 = 0;
        for (Question q : tech1) {
            if (techDrawn1 >= 25)
                break;
            if (selectedIds.add(q.getId())) {
                techDrawn1++;
            }
        }
        int techDrawn2 = 0;
        for (Question q : tech2) {
            if (techDrawn2 >= 25)
                break;
            if (selectedIds.add(q.getId())) {
                techDrawn2++;
            }
        }

        // Fail-safe 1: Backfill remaining Technical slots up to 65 from finalTechPool
        if (selectedIds.size() < 65) {
            for (Question q : finalTechPool) {
                if (selectedIds.size() >= 65)
                    break;
                selectedIds.add(q.getId());
            }
        }

        // Fail-safe 2: Backfill remaining slots up to 65 from aptPool
        if (selectedIds.size() < 65) {
            for (Question q : aptPool) {
                if (selectedIds.size() >= 65)
                    break;
                selectedIds.add(q.getId());
            }
        }

        // Fail-safe 3: Ultimate backfill from ANY questions in DB to ALWAYS guarantee 65 items
        if (selectedIds.size() < 65) {
            List<Question> anyExtras = questionRepository.findRandomAnyCandidates(150);
            for (Question q : anyExtras) {
                if (selectedIds.size() >= 65)
                    break;
                selectedIds.add(q.getId());
            }
        }

        List<Long> targetIds = new ArrayList<>(selectedIds);
        if (targetIds.size() > 65) {
            targetIds = targetIds.subList(0, 65);
        }

        // 🚀 BULK FETCH: Load all 65 questions WITH options, subject, and topic in 1 SINGLE SQL QUERY!
        List<Question> fullyLoaded = targetIds.isEmpty() ? new ArrayList<>() : questionRepository.findAllByIdInWithOptions(targetIds);

        // Sanitize DTOs for test security — strip correct answers and explanations during test-taking
        List<QuestionDTO> sanitized = fullyLoaded.stream().map(q -> {
            QuestionDTO dto = questionMapper.convertToDTOFast(q);
            dto.setAiSuggestedAnswer(null);
            dto.setAiSuggestedExplanation(null);
            dto.setAiMentorInsights(null);
            dto.setRawAiJson(null);
            return dto;
        }).collect(Collectors.toList());

        log.info("Assembled GATE simulator exam (mode: {}) with {} questions in {}ms for user {}",
                mode, sanitized.size(), System.currentTimeMillis() - startTime,
                userDetails != null ? userDetails.getId() : "GUEST");

        return ResponseEntity.ok(sanitized);
    }

    // ── AI Generation Batch Management Endpoints ──────────────────────────────
    private String resolveBatchKey(Question q) {
        if (q.getPdfSourceName() != null && q.getPdfSourceName().matches("AI_NIGHTLY_\\d{4}-\\d{2}-\\d{2}")) {
            return q.getPdfSourceName();
        }
        if (q.getCreatedAt() != null) {
            return "AI_NIGHTLY_" + q.getCreatedAt().toLocalDate().toString();
        }
        return q.getPdfSourceName() != null ? q.getPdfSourceName() : "AI_NIGHTLY_UNKNOWN";
    }

    @GetMapping("/admin/ai-batches")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> getAiGenerationBatches() {
        List<Question> aiQuestions = questionRepository.findAllAiGeneratedQuestions();

        Map<String, List<Question>> grouped = aiQuestions.stream()
                .collect(Collectors.groupingBy(this::resolveBatchKey));

        List<Map<String, Object>> result = new ArrayList<>();
        grouped.forEach((batchName, qList) -> {
            Map<String, Object> map = new HashMap<>();
            map.put("batchName", batchName);
            map.put("totalQuestions", qList.size());
            map.put("pendingCount", qList.stream().filter(
                    q -> "PENDING_REVIEW".equalsIgnoreCase(q.getStatus()) || "PENDING".equalsIgnoreCase(q.getStatus()))
                    .count());
            map.put("approvedCount", qList.stream().filter(q -> "APPROVED".equalsIgnoreCase(q.getStatus())).count());
            result.add(map);
        });

        result.sort((a, b) -> String.valueOf(b.get("batchName")).compareTo(String.valueOf(a.get("batchName"))));
        return ResponseEntity.ok(result);
    }

    @DeleteMapping("/admin/ai-batches/{batchName}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<Map<String, Object>> deleteAiBatch(@PathVariable String batchName) {
        List<Question> aiQuestions = questionRepository.findAllAiGeneratedQuestions().stream()
                .filter(q -> resolveBatchKey(q).equalsIgnoreCase(batchName))
                .collect(Collectors.toList());

        if (aiQuestions.isEmpty()) {
            return ResponseEntity
                    .ok(Map.of("message", "No questions found for batch: " + batchName, "deletedCount", 0));
        }

        List<Long> qIds = aiQuestions.stream().map(Question::getId).collect(Collectors.toList());
        questionRepository.deleteQuestionTagsIn(qIds);
        questionRepository.deleteQuestionsBulk(qIds);

        log.info("🗑️ [Admin] Batch deleted! Purged {} questions from batch: {}", qIds.size(), batchName);
        return ResponseEntity
                .ok(Map.of("message", "Successfully purged AI batch: " + batchName, "deletedCount", qIds.size()));
    }

    @PostMapping("/{id}/regenerate-explanation")
    @PreAuthorize("hasAnyRole('ADMIN', 'EDITOR')")
    @Transactional
    public ResponseEntity<?> regenerateExplanation(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Optional<Question> qOpt = questionRepository.findById(id);
        if (qOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        Question question = qOpt.get();
        QuestionAIAnalysis aiAnalysis = aiAnalysisRepository.findFirstByQuestionIdOrderByCreatedAtDesc(id).orElse(null);
        String correctOption = aiAnalysis != null && aiAnalysis.getSuggestedAnswer() != null
                ? aiAnalysis.getSuggestedAnswer()
                : "A";

        StringBuilder optsSb = new StringBuilder();
        if (question.getOptions() != null && !question.getOptions().isEmpty()) {
            for (QuestionOption opt : question.getOptions()) {
                optsSb.append("Option ").append(opt.getOptionLabel()).append(": ").append(opt.getOptionText())
                        .append("\n");
            }
        }

        List<String> images = new ArrayList<>();
        if (question.getImagePath() != null && !question.getImagePath().isBlank()) {
            images.add(question.getImagePath());
        }

        AIClassificationService.SolutionResult result = aiClassificationService.generateDetailedSolution(
                question.getText(),
                optsSb.toString(),
                correctOption,
                images);

        if (aiAnalysis == null) {
            aiAnalysis = QuestionAIAnalysis.builder()
                    .question(question)
                    .suggestedAnswer(correctOption)
                    .modelName(systemSettingService.getGroqHeavyModel())
                    .build();
        }

        aiAnalysis.setMentorInsights(result.shortSolution);
        aiAnalysis.setSuggestedExplanation(result.detailedSolution);
        aiAnalysis.setModelName(systemSettingService.getGroqHeavyModel());
        aiAnalysisRepository.save(aiAnalysis);

        // Verification Gate
        if (result.concludedAnswer != null && correctOption != null) {
            String cleanConcluded = result.concludedAnswer.trim().toUpperCase().replaceAll("[^A-Z0-9\\.]", "");
            String cleanExpected = correctOption.trim().toUpperCase().replaceAll("[^A-Z0-9\\.]", "");

            boolean matched = cleanConcluded.equalsIgnoreCase(cleanExpected) || cleanConcluded.contains(cleanExpected)
                    || cleanExpected.contains(cleanConcluded);
            question.setIsCommunityVerified(matched);
            questionRepository.save(question);
        }

        return ResponseEntity.ok(convertToDTO(question));
    }

    @PostMapping("/{id}/re-analyze")
    @PreAuthorize("hasRole('ADMIN') or hasRole('EDITOR')")
    public ResponseEntity<?> reAnalyzeQuestion(@PathVariable("id") Long id) {
        Optional<Question> qOpt = questionRepository.findById(id);
        if (qOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found with ID: " + id));
        }
        Question question = qOpt.get();
        String rawText = question.getRawOcrText();

        // If rawOcrText is absent (e.g. for AI Practice Questions), construct text
        // block from current question & options
        if (rawText == null || rawText.isBlank()) {
            StringBuilder sb = new StringBuilder();
            if (question.getText() != null)
                sb.append(question.getText()).append("\n\n");
            if (question.getOptions() != null && !question.getOptions().isEmpty()) {
                sb.append("Options:\n");
                for (QuestionOption opt : question.getOptions()) {
                    sb.append(opt.getOptionLabel()).append(") ").append(opt.getOptionText()).append("\n");
                }
            }
            rawText = sb.toString().trim();
        }

        if (rawText.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: Question has no text or OCR data to re-analyze."));
        }

        try {
            AIClassificationService.AIAnalysisResult aiRes = aiClassificationService.classifyQuestion(
                    rawText,
                    question.getPdfSourceName() != null ? question.getPdfSourceName() : "Manual Rephrase");
            return ResponseEntity.ok(aiRes);
        } catch (Exception e) {
            log.error("Re-analysis failed for question {}: {}", id, e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new MessageResponse("AI Re-Analysis failed: " + e.getMessage()));
        }
    }
}
