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

    public QuestionController(QuestionService questionService, QuestionRepository questionRepository,
            SubjectRepository subjectRepository,
            TopicRepository topicRepository, UserRepository userRepository,
            QuestionAIAnalysisRepository aiAnalysisRepository,
            CloudinaryService cloudinaryService,
            QuestionMapper questionMapper,
            BookmarkRepository bookmarkRepository,
            UserQuestionSolveRepository solveRepository) {
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
    }

    // Public search with filters (anonymous access mapped in SecurityConfig)
    @GetMapping
    @Transactional(readOnly = true)
    @org.springframework.cache.annotation.Cacheable(value = "questions", key = "T(java.util.Objects).hash(#query, #subjectId, #topicId, #year, #questionType, #tagName, #solvedStatus, #bookmarked, #status, #page, #size, #userDetails != null ? #userDetails.getId() : 0)")
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
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Pageable pageable = PageRequest.of(page, size);
        Long userId = (userDetails != null) ? userDetails.getId() : null;

        Page<Question> questionsPage = questionService.searchQuestions(query, subjectId, topicId, year, questionType,
                tagName, status, userId, solvedStatus, bookmarked, pageable);

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
        } catch (Exception ignored) {}

        int qNum = 1;
        try {
            qNum = Integer.parseInt(qNumStr.toLowerCase().replace("q", "").trim());
        } catch (Exception ignored) {}

        Optional<Question> qOpt = questionRepository.findFirstByBranchAndYearAndPaperSetAndQuestionNumber(
                branch.toLowerCase().trim(), year, setNum, qNum);
        
        if (qOpt.isEmpty()) {
            qOpt = questionRepository.findFirstByQuestionNumber(qNum);
        }

        if (qOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found for GATE " + branch + " " + year + " Set-" + setNum + " Q" + qNum));
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
        } catch (Exception ignored) {}

        String canonicalSubjectName = SubjectSlugUtils.toCanonicalSubjectName(subjectSlug);
        Optional<Question> qOpt = Optional.empty();

        if (canonicalSubjectName != null) {
            Optional<Subject> subOpt = subjectRepository.findByName(canonicalSubjectName);
            if (subOpt.isPresent()) {
                qOpt = questionRepository.findFirstBySubjectIdAndQuestionNumber(subOpt.get().getId(), qNum);
            }
        }

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

    private QuestionDTO convertToDTO(Question question) {
        return questionMapper.convertToDTO(question);
    }

    private QuestionDTO convertToDTOFast(Question question) {
        return questionMapper.convertToDTOFast(question);
    }

    // Get simulated exam with 65 questions matching standard GATE weightage
    @GetMapping("/simulator")
    @Transactional(readOnly = true)
    public ResponseEntity<?> getSimulatorExam() {

        // GATE 2024 blueprint: [subjectKeyword, 1-mark count, 2-mark count]
        // Each entry fetches directly from DB using ORDER BY RAND() — no full table
        // load.
        record BlueprintEntry(String keyword, int req1Mark, int req2Mark) {
        }

        List<BlueprintEntry> blueprint = List.of(
                new BlueprintEntry("aptitude", 5, 5),
                new BlueprintEntry("math", 4, 5),
                new BlueprintEntry("discrete", 0, 0), // covered by "math" keyword umbrella
                new BlueprintEntry("digital", 2, 1),
                new BlueprintEntry("organization", 2, 2),
                new BlueprintEntry("programming", 3, 3),
                new BlueprintEntry("algorithm", 3, 3),
                new BlueprintEntry("computation", 3, 3),
                new BlueprintEntry("compiler", 2, 1),
                new BlueprintEntry("operating", 3, 3),
                new BlueprintEntry("database", 2, 2),
                new BlueprintEntry("network", 1, 4));

        List<QuestionDTO> selected = new ArrayList<>();
        Set<Long> selectedIds = new HashSet<>();

        // Load all subjects once for keyword matching
        List<com.pyq.platform.entity.Subject> allSubjects = subjectRepository.findAll();

        for (BlueprintEntry entry : blueprint) {
            if (entry.req1Mark() == 0 && entry.req2Mark() == 0)
                continue;

            // Find matching subjects by keyword
            List<Long> matchingSubjectIds = allSubjects.stream()
                    .filter(s -> s.getName().toLowerCase().contains(entry.keyword()))
                    .map(com.pyq.platform.entity.Subject::getId)
                    .collect(Collectors.toList());

            if (matchingSubjectIds.isEmpty())
                continue;

            int totalNeeded = entry.req1Mark() + entry.req2Mark();
            // Fetch slightly more than needed to account for mark-split filtering, then
            // trim
            int fetchLimit = totalNeeded * 3 + 10;

            List<Question> pool = new ArrayList<>();
            for (Long subjectId : matchingSubjectIds) {
                pool.addAll(questionRepository.findRandomApprovedBySubject(subjectId, fetchLimit));
            }

            // Split by marks
            List<Question> pool1 = pool.stream()
                    .filter(q -> !selectedIds.contains(q.getId()) && q.getMarks() != null && q.getMarks() == 1)
                    .distinct().collect(Collectors.toList());
            List<Question> pool2 = pool.stream()
                    .filter(q -> !selectedIds.contains(q.getId()) && q.getMarks() != null && q.getMarks() == 2)
                    .distinct().collect(Collectors.toList());

            // Pick up to required amounts
            int drawn1 = 0;
            for (Question q : pool1) {
                if (drawn1 >= entry.req1Mark())
                    break;
                selected.add(questionMapper.convertToDTO(q));
                selectedIds.add(q.getId());
                drawn1++;
            }

            int drawn2 = 0;
            for (Question q : pool2) {
                if (drawn2 >= entry.req2Mark())
                    break;
                selected.add(questionMapper.convertToDTO(q));
                selectedIds.add(q.getId());
                drawn2++;
            }
        }

        // Fill any remaining slots up to 65 from general pool
        if (selected.size() < 65) {
            int remaining = 65 - selected.size();
            List<Question> extras = questionRepository.findRandomApproved(remaining * 2);
            for (Question q : extras) {
                if (selected.size() >= 65)
                    break;
                if (!selectedIds.contains(q.getId())) {
                    selected.add(questionMapper.convertToDTO(q));
                    selectedIds.add(q.getId());
                }
            }
        }

        // Hard cap at 65
        if (selected.size() > 65) {
            selected = selected.subList(0, 65);
        }

        return ResponseEntity.ok(selected);
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
            map.put("pendingCount", qList.stream().filter(q -> "PENDING_REVIEW".equalsIgnoreCase(q.getStatus()) || "PENDING".equalsIgnoreCase(q.getStatus())).count());
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
            return ResponseEntity.ok(Map.of("message", "No questions found for batch: " + batchName, "deletedCount", 0));
        }

        List<Long> qIds = aiQuestions.stream().map(Question::getId).collect(Collectors.toList());
        questionRepository.deleteQuestionTagsIn(qIds);
        questionRepository.deleteQuestionsBulk(qIds);

        log.info("🗑️ [Admin] Batch deleted! Purged {} questions from batch: {}", qIds.size(), batchName);
        return ResponseEntity.ok(Map.of("message", "Successfully purged AI batch: " + batchName, "deletedCount", qIds.size()));
    }
}
