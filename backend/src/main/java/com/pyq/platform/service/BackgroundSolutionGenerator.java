package com.pyq.platform.service;

import com.pyq.platform.entity.QuestionAIAnalysis;
import com.pyq.platform.repository.QuestionAIAnalysisRepository;
import com.pyq.platform.repository.UploadJobRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;

/**
 * Background worker that generates detailed AI solutions for questions
 * that have only been fast-classified (model_name = 'fast-parse').
 *
 * DESIGN PRINCIPLE (2-phase approach):
 *   Phase 1 — PDF Upload (UploadService): Classify ALL questions (subject/topic/answer).
 *             Uses minimal tokens (250 max_tokens per question). Stores model_name='fast-parse'.
 *   Phase 2 — This worker: After ALL questions are stored, generate detailed solutions
 *             one-by-one at a safe rate of 1 per 65 seconds.
 *             PAUSES automatically when any PDF upload is active.
 */
@Service
@Slf4j
public class BackgroundSolutionGenerator {

    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final AIClassificationService aiClassificationService;
    private final UploadJobRepository uploadJobRepository;
    private final TransactionTemplate transactionTemplate;

    // Statuses that indicate an upload is actively consuming Groq API quota
    private static final List<String> ACTIVE_UPLOAD_STATUSES = List.of("PARSING", "CLASSIFYING");

    public BackgroundSolutionGenerator(QuestionAIAnalysisRepository aiAnalysisRepository,
                                       AIClassificationService aiClassificationService,
                                       UploadJobRepository uploadJobRepository,
                                       org.springframework.transaction.PlatformTransactionManager transactionManager) {
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.aiClassificationService = aiClassificationService;
        this.uploadJobRepository = uploadJobRepository;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    private static class QuestionData {
        String text;
        String answer;
        Long id;
        Long questionId;
        List<String> imageUrlsOrPaths;
    }

    /**
     * Runs every 65 seconds (fixedDelay = after completion).
     * Safe for Groq free tier: detailed solutions use ~1200-1600 tokens each.
     * At 6000 TPM limit, 1 call per 65s keeps us well under the limit.
     */
    @Scheduled(fixedDelay = 65000)
    public void generatePendingSolutions() {
        // ── PHASE CHECK: If a PDF is currently being parsed/classified, skip this tick ──
        boolean uploadActive = uploadJobRepository.existsByStatusIn(ACTIVE_UPLOAD_STATUSES);
        if (uploadActive) {
            log.info("BackgroundSolutionGenerator: PDF upload in progress — skipping this tick to avoid rate limits.");
            return;
        }

        // Auto-recover any failed/stuck solution records back to pending queue
        try {
            int resetCount = aiAnalysisRepository.resetFailedSolutionsToPending();
            if (resetCount > 0) {
                log.info("🔄 [BackgroundSolutionGenerator] Re-queued {} failed/stuck solution(s) for generation.", resetCount);
            }
        } catch (Exception ignored) {}

        // Load data inside transaction template
        QuestionData data = transactionTemplate.execute(status -> {
            List<QuestionAIAnalysis> analyses = aiAnalysisRepository.findPendingApprovedByModelName(
                    "fast-parse", org.springframework.data.domain.PageRequest.of(0, 1)
            );
            if (analyses.isEmpty()) {
                return null;
            }
            QuestionAIAnalysis target = analyses.get(0);

            QuestionData qd = new QuestionData();
            qd.text = target.getQuestion().getText();
            qd.answer = target.getSuggestedAnswer();
            qd.id = target.getId();
            qd.questionId = target.getQuestion().getId();
            
            // Collect images from question body and options
            qd.imageUrlsOrPaths = new java.util.ArrayList<>();
            String questionImg = target.getQuestion().getImagePath();
            if (questionImg != null && !questionImg.trim().isEmpty()) {
                qd.imageUrlsOrPaths.add(questionImg);
            }
            if (target.getQuestion().getOptions() != null) {
                for (com.pyq.platform.entity.QuestionOption opt : target.getQuestion().getOptions()) {
                    String optText = opt.getOptionText();
                    if (optText != null && (optText.startsWith("/uploads/") || optText.startsWith("http://") || optText.startsWith("https://"))) {
                        qd.imageUrlsOrPaths.add(optText);
                    }
                }
            }
            return qd;
        });

        if (data == null) {
            log.debug("BackgroundSolutionGenerator: No pending approved questions — all solutions up to date.");
            return;
        }

        long pending = aiAnalysisRepository.countPendingApprovedByModelName("fast-parse");
        log.info("BackgroundSolutionGenerator: Generating solution for approved question ID {} ({} questions remaining in queue)...",
                data.questionId, pending);

        try {
            // ── GROQ CALL: Generate both short trick + full step-by-step with image references if any ──
            AIClassificationService.SolutionResult result = aiClassificationService.generateDetailedSolution(
                    data.text,
                    data.answer,
                    data.imageUrlsOrPaths
            );

            // ── SAVE: Store both parts into DB ──
            transactionTemplate.executeWithoutResult(status -> {
                QuestionAIAnalysis record = aiAnalysisRepository.findById(data.id).orElseThrow();
                record.setMentorInsights(result.shortSolution);        // Quick answer + GATE trick
                record.setSuggestedExplanation(result.detailedSolution); // Full step-by-step
                record.setModelName("llama-3.1-8b-comprehensive");
                aiAnalysisRepository.save(record);
            });

            log.info("BackgroundSolutionGenerator: Solution saved for question ID {}. {} still pending.",
                    data.questionId, pending - 1);

        } catch (Exception e) {
            log.error("BackgroundSolutionGenerator: Failed for question ID {}: {}", data.questionId, e.getMessage());
            // Do NOT mark as failed — it will be retried on the next tick
        }
    }
}
