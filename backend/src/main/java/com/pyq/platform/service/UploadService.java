package com.pyq.platform.service;

import com.pyq.platform.entity.*;
import com.pyq.platform.repository.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@Slf4j
public class UploadService {

    private final UploadJobRepository uploadJobRepository;
    private final PDFParserService pdfParserService;
    private final AIClassificationService aiClassificationService;
    private final QuestionService questionService;

    private final TagRepository tagRepository;

    private final SubjectRepository subjectRepository;
    private final TopicRepository topicRepository;
    private final QuestionRepository questionRepository;
    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final org.springframework.transaction.support.TransactionTemplate transactionTemplate;
    private final CloudinaryService cloudinaryService;
    private final CacheManager cacheManager;

    public UploadService(UploadJobRepository uploadJobRepository, PDFParserService pdfParserService,
            AIClassificationService aiClassificationService, QuestionService questionService,
            TagRepository tagRepository,
            SubjectRepository subjectRepository, TopicRepository topicRepository,
            QuestionRepository questionRepository, QuestionAIAnalysisRepository aiAnalysisRepository,
            org.springframework.transaction.PlatformTransactionManager transactionManager,
            CloudinaryService cloudinaryService,
            CacheManager cacheManager) {
        this.uploadJobRepository = uploadJobRepository;
        this.pdfParserService = pdfParserService;
        this.aiClassificationService = aiClassificationService;
        this.questionService = questionService;
        this.tagRepository = tagRepository;
        this.subjectRepository = subjectRepository;
        this.topicRepository = topicRepository;
        this.questionRepository = questionRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.transactionTemplate = new org.springframework.transaction.support.TransactionTemplate(transactionManager);
        this.cloudinaryService = cloudinaryService;
        this.cacheManager = cacheManager;
    }

    public UploadJob createUploadJob(MultipartFile file, User user) throws IOException {
        String originalName = file.getOriginalFilename();
        String filePath;

        if (cloudinaryService.isConfigured()) {
            filePath = cloudinaryService.uploadMultipartFile(file, "pdfs");
            if (filePath == null) {
                throw new IOException("Failed to upload PDF to Cloudinary");
            }
        } else {
            // Save file locally using absolute path
            String uniqueName = UUID.randomUUID().toString().substring(0, 8) + "_" + originalName;
            File destFile = new File("uploads/pdfs/" + uniqueName).getAbsoluteFile();
            destFile.getParentFile().mkdirs();
            file.transferTo(destFile);
            filePath = destFile.getAbsolutePath();
        }

        UploadJob job = UploadJob.builder()
                .filename(originalName)
                .filePath(filePath)
                .status("PENDING")
                .createdBy(user)
                .build();

        return uploadJobRepository.save(job);
    }

    private File downloadFileFromUrl(String fileUrl) throws IOException {
        java.net.URL url = new java.net.URL(fileUrl);
        File tempFile = File.createTempFile("pdf_download_", ".pdf");
        tempFile.deleteOnExit();
        try (java.io.InputStream in = url.openStream()) {
            java.nio.file.Files.copy(in, tempFile.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
        return tempFile;
    }

    @Async
    public void processUploadJobAsync(Long jobId, String localPath) {
        Optional<UploadJob> jobOpt = uploadJobRepository.findById(jobId);
        if (jobOpt.isEmpty()) {
            log.error("Job not found with ID: {}", jobId);
            return;
        }

        transactionTemplate.executeWithoutResult(status -> {
            UploadJob job = uploadJobRepository.findById(jobId).orElseThrow();
            job.setStatus("PARSING");
            job.setStartedAt(LocalDateTime.now());
            uploadJobRepository.save(job);
        });

        File downloadedFile = null;
        try {
            String parsePath = localPath;
            if (localPath.startsWith("http://") || localPath.startsWith("https://")) {
                log.info("Downloading PDF from Cloudinary URL: {}", localPath);
                downloadedFile = downloadFileFromUrl(localPath);
                parsePath = downloadedFile.getAbsolutePath();
            }

            // 1. PDF Text & Images parsing
            log.info("Parsing PDF page-by-page for job: {}", jobId);
            List<PDFParserService.RawQuestionBlock> rawBlocks = pdfParserService.parsePDF(parsePath, jobId);

            transactionTemplate.executeWithoutResult(status -> {
                UploadJob job = uploadJobRepository.findById(jobId).orElseThrow();
                job.setStatus("CLASSIFYING");
                job.setTotalQuestionsFound(rawBlocks.size());
                uploadJobRepository.save(job);
            });

            int processed = 0;
            int duplicate = 0;
            int failed = 0;

            // 2. Classify and store each block
            for (PDFParserService.RawQuestionBlock block : rawBlocks) {
                // Pause-check loop: wait if status is PAUSED, abort if status is FAILED or deleted
                while (true) {
                    UploadJob checkJob = uploadJobRepository.findById(jobId).orElse(null);
                    if (checkJob == null || "FAILED".equalsIgnoreCase(checkJob.getStatus())) {
                        log.warn("Job {} was deleted or marked FAILED. Halting classification loop.", jobId);
                        return;
                    }
                    if ("PAUSED".equalsIgnoreCase(checkJob.getStatus())) {
                        try {
                            Thread.sleep(2000);
                        } catch (InterruptedException ie) {
                            Thread.currentThread().interrupt();
                            return;
                        }
                        continue;
                    }
                    break;
                }

                try {
                    // Rate limiting: 4s gap between classification calls keeps us under Groq free-tier RPM.
                    // BackgroundSolutionGenerator is paused during upload, so no competition for quota.
                    try {
                        Thread.sleep(4000);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                    }

                    // Extract year from filename if possible
                    int year = extractYearFromFilename(jobOpt.get().getFilename());

                    // Call AI service for structured values (outside transactional block to prevent database lock delays)
                    AIClassificationService.AIAnalysisResult aiRes = aiClassificationService
                            .classifyQuestion(block.rawText, jobOpt.get().getFilename());

                    // Duplicate detection via checksum hash and year
                    boolean isDuplicate = transactionTemplate.execute(status -> {
                        String checksum = questionService.generateChecksum(aiRes.questionText);
                        return questionRepository.existsByChecksumHashAndYear(checksum, year);
                    });

                    if (isDuplicate) {
                        duplicate++;
                        final int currentDuplicate = duplicate;
                        transactionTemplate.executeWithoutResult(status -> {
                            UploadJob job = uploadJobRepository.findById(jobId).orElseThrow();
                            job.setDuplicateQuestions(currentDuplicate);
                            uploadJobRepository.save(job);
                        });
                        continue;
                    }

                    // Save the question block, options, and tags in a dedicated short transaction
                    transactionTemplate.executeWithoutResult(status -> {
                        aiRes.questionText = AIClassificationService.stripQuestionNumbering(aiRes.questionText);

                        List<String> optionTextsVal = aiRes.options;
                        if (optionTextsVal == null || optionTextsVal.isEmpty()) {
                            if (!"NAT".equalsIgnoreCase(aiRes.questionType)) {
                                optionTextsVal = extractOptionsFromBlockText(block.rawText);
                                aiRes.questionText = AIClassificationService.stripQuestionNumbering(cleanQuestionTextLocally(block.rawText));
                            }
                        }
                        final List<String> optionTexts = optionTextsVal;

                        String checksum = questionService.generateChecksum(aiRes.questionText);
                        Subject subject = resolveSubject(aiRes.subjectName);
                        Topic topic = resolveTopic(subject, aiRes.parentTopicName, aiRes.topicName);

                        // Auto-approval checks
                        boolean isNat = "NAT".equalsIgnoreCase(aiRes.questionType);
                        boolean hasValidOptions = isNat || (optionTexts != null && !optionTexts.isEmpty() 
                                && !optionTexts.get(0).startsWith("Option A description placeholder."));

                        boolean hasDiagram = (block.imagePath != null && !block.imagePath.isEmpty())
                                || containsDiagramKeywords(aiRes.questionText)
                                || containsDiagramKeywords(block.rawText);

                        boolean hasAIAnswer = aiRes.suggestedAnswer != null 
                                && !aiRes.suggestedAnswer.trim().isEmpty() 
                                && !aiRes.suggestedAnswer.equalsIgnoreCase("N/A") 
                                && !aiRes.suggestedAnswer.equalsIgnoreCase("unknown");

                        boolean hasValidText = aiRes.questionText != null 
                                && !aiRes.questionText.trim().isEmpty() 
                                && aiRes.questionText.length() >= 15;

                        String questionStatus = "PENDING";

                        Question question = Question.builder()
                                .text(aiRes.questionText)
                                .questionType(aiRes.questionType)
                                .marks(aiRes.marks)
                                .negativeMarks(aiRes.negativeMarks)
                                .year(year)
                                .subject(subject)
                                .topic(topic)
                                .checksumHash(checksum)
                                .pdfSourceName(jobOpt.get().getFilename())
                                .pdfSourcePath(localPath)
                                .pdfPageNumber(block.pageNumber)
                                .imagePath(block.imagePath)
                                .rawOcrText(block.rawText)
                                .status(questionStatus)
                                .build();

                        List<QuestionOption> options = new ArrayList<>();
                        if (!isNat && optionTexts != null) {
                            for (int i = 0; i < optionTexts.size(); i++) {
                                options.add(QuestionOption.builder()
                                        .question(question)
                                        .optionLabel(String.valueOf((char) ('A' + i)))
                                        .optionText(optionTexts.get(i))
                                        .build());
                            }
                        }
                        question.setOptions(options);

                        Set<Tag> tags = new HashSet<>();
                        for (String tName : aiRes.tags) {
                            String cleanTag = tName.trim().toLowerCase();
                            if (cleanTag.isEmpty())
                                continue;
                            Tag tag = tagRepository.findByName(cleanTag)
                                     .orElseGet(() -> tagRepository.save(Tag.builder().name(cleanTag).build()));
                            tags.add(tag);
                        }
                        question.setTags(tags);

                        Question savedQ = questionRepository.save(question);

                        aiAnalysisRepository.save(QuestionAIAnalysis.builder()
                                .question(savedQ)
                                .suggestedAnswer(aiRes.suggestedAnswer)
                                .suggestedExplanation(aiRes.suggestedExplanation)
                                .mentorInsights(aiRes.mentorInsights)
                                .confidence(aiRes.confidenceScore)
                                .questionConfidence(aiRes.questionConfidence)
                                .optionsConfidence(aiRes.optionsConfidence)
                                .answerConfidence(aiRes.answerConfidence)
                                .rawAiJson(aiRes.rawAiJson)
                                .promptVersion("v1")
                                .modelName("fast-parse")
                                .build());
                    });

                    processed++;
                    final int currentProcessed = processed;
                    transactionTemplate.executeWithoutResult(status -> {
                        UploadJob job = uploadJobRepository.findById(jobId).orElseThrow();
                        job.setProcessedQuestions(currentProcessed);
                        uploadJobRepository.save(job);
                    });

                } catch (Exception e) {
                    log.error("Failed to process question block for job {}: {}", jobId, e.getMessage());
                    failed++;
                    final int currentFailed = failed;
                    transactionTemplate.executeWithoutResult(status -> {
                        UploadJob job = uploadJobRepository.findById(jobId).orElseThrow();
                        job.setFailedQuestions(currentFailed);
                        uploadJobRepository.save(job);
                    });
                }
            }

            // Mark job complete
            transactionTemplate.executeWithoutResult(status -> {
                UploadJob job = uploadJobRepository.findById(jobId).orElseThrow();
                job.setStatus("COMPLETED");
                job.setCompletedAt(LocalDateTime.now());
                job.setProcessingTimeMs(Duration.between(job.getStartedAt(), job.getCompletedAt()).toMillis());
                uploadJobRepository.save(job);
                log.info("PDF upload job {} completed in {} ms.", jobId, job.getProcessingTimeMs());
            });

        } catch (Exception e) {
            log.error("Fatal error running PDF processing job {}: {}", jobId, e.getMessage());
            transactionTemplate.executeWithoutResult(status -> {
                UploadJob job = uploadJobRepository.findById(jobId).orElseThrow();
                job.setStatus("FAILED");
                job.setErrorMessage(e.getMessage());
                job.setCompletedAt(LocalDateTime.now());
                if (job.getStartedAt() != null) {
                    job.setProcessingTimeMs(Duration.between(job.getStartedAt(), job.getCompletedAt()).toMillis());
                }
                uploadJobRepository.save(job);
            });
        } finally {
            clearCaches();
            if (downloadedFile != null && downloadedFile.exists()) {
                try {
                    downloadedFile.delete();
                } catch (Exception de) {
                    log.warn("Failed to delete temp PDF file: {}", de.getMessage());
                }
            }
        }
    }

    private void clearCaches() {
        try {
            if (cacheManager != null) {
                log.info("Evicting all caching groups (questions, years, subjects, topicTrees) post-ingestion.");
                for (String cacheName : Arrays.asList("questions", "years", "subjects", "topicTrees")) {
                    Cache cache = cacheManager.getCache(cacheName);
                    if (cache != null) {
                        cache.clear();
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to clear caches: {}", e.getMessage());
        }
    }

    private Subject resolveSubject(String rawName) {
        String name = AIClassificationService.normalizeSubjectName(rawName);
        return subjectRepository.findByName(name)
                .orElseGet(() -> subjectRepository.save(Subject.builder().name(name).build()));
    }

    private Topic resolveTopic(Subject subject, String rawParentName, String rawChildName) {
        String parentName = AIClassificationService.cleanTopicName(rawParentName);
        String childName = AIClassificationService.cleanTopicName(rawChildName);
        
        // Resolve parent topic
        Topic parent = topicRepository.findByNameAndSubjectIdAndParentTopicIsNull(parentName, subject.getId())
                .orElseGet(() -> topicRepository.save(Topic.builder()
                        .name(parentName)
                        .subject(subject)
                        .build()));

        // Resolve leaf subtopic
        return topicRepository.findByNameAndSubjectIdAndParentTopicId(childName, subject.getId(), parent.getId())
                .orElseGet(() -> topicRepository.save(Topic.builder()
                        .name(childName)
                        .subject(subject)
                        .parentTopic(parent)
                        .build()));
    }

    private int extractYearFromFilename(String filename) {
        Pattern yearPattern = Pattern.compile("(20\\d{2}|19\\d{2})");
        Matcher m = yearPattern.matcher(filename);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        return LocalDateTime.now().getYear(); // fallback to current year
    }

    private List<String> extractOptionsFromBlockText(String rawText) {
        List<String> options = new ArrayList<>();
        // Look for (A) / A) patterns up to Z
        Pattern optionPattern = Pattern.compile(
                "(?i)(?:^|\\n)\\s*(?:\\(?([A-Z])\\)?|([A-Z])\\s*\\))\\s+(.*?)(?=\\n\\s*(?:\\(?[A-Z]\\)?|[A-Z]\\s*\\))|$)");
        Matcher m = optionPattern.matcher(rawText);

        // Find all matches
        Map<String, String> optionMap = new TreeMap<>();
        while (m.find()) {
            String label = m.group(1) != null ? m.group(1) : m.group(2);
            String text = m.group(3);
            if (label != null && text != null) {
                optionMap.put(label.toUpperCase(), text.trim());
            }
        }

        if (!optionMap.isEmpty()) {
            char maxChar = 'A';
            for (String key : optionMap.keySet()) {
                if (key.length() == 1) {
                    char c = key.charAt(0);
                    if (c > maxChar && c <= 'Z') {
                        maxChar = c;
                    }
                }
            }
            // Ensure we output at least A-D if options exist but maxChar is smaller,
            // or up to maxChar if it exceeds D.
            char endChar = (maxChar < 'D') ? 'D' : maxChar;
            for (char c = 'A'; c <= endChar; c++) {
                String val = optionMap.get(String.valueOf(c));
                if (val != null) {
                    options.add(val);
                } else {
                    options.add("Option " + c + " placeholder");
                }
            }
        } else {
            // Fallback placeholders if none matched
            options.add("Option A description placeholder.");
            options.add("Option B description placeholder.");
            options.add("Option C description placeholder.");
            options.add("Option D description placeholder.");
        }

        return options;
    }

    private boolean containsDiagramKeywords(String text) {
        if (text == null) return false;
        String lower = text.toLowerCase();
        return lower.contains("figure") ||
               lower.contains("diagram") ||
               lower.contains("map") ||
               lower.contains("table") ||
               lower.contains("graph") ||
               lower.contains("chart") ||
               lower.contains("shown below") ||
               lower.contains("drawn below") ||
               lower.contains("following diagram") ||
               lower.contains("following figure") ||
               lower.contains("following map") ||
               lower.contains("following graph") ||
               lower.contains("following table") ||
               lower.contains("following chart") ||
               lower.contains("given below");
    }

    private String cleanQuestionTextLocally(String rawText) {
        if (rawText == null) return "";
        Pattern optionStartPattern = Pattern.compile("(?i)(?:^|\\n|\\r)\\s*(?:\\(?([A-Z])\\)?|([A-Z])\\s*\\))\\s+");
        Matcher m = optionStartPattern.matcher(rawText);
        if (m.find()) {
            return rawText.substring(0, m.start()).trim();
        }
        return rawText;
    }
}
