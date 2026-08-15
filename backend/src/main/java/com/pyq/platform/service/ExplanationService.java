package com.pyq.platform.service;

import com.pyq.platform.entity.AIFailureLog;
import com.pyq.platform.entity.Question;
import com.pyq.platform.entity.QuestionAIAnalysis;
import com.pyq.platform.entity.QuestionOption;
import com.pyq.platform.repository.AIFailureLogRepository;
import com.pyq.platform.repository.QuestionAIAnalysisRepository;
import com.pyq.platform.repository.QuestionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class ExplanationService {

    private final QuestionRepository questionRepository;
    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final AIFailureLogRepository aiFailureLogRepository;
    private final AIClassificationService aiClassificationService;
    private final SystemSettingService systemSettingService;

    public ExplanationService(QuestionRepository questionRepository,
                              QuestionAIAnalysisRepository aiAnalysisRepository,
                              AIFailureLogRepository aiFailureLogRepository,
                              AIClassificationService aiClassificationService,
                              SystemSettingService systemSettingService) {
        this.questionRepository = questionRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.aiFailureLogRepository = aiFailureLogRepository;
        this.aiClassificationService = aiClassificationService;
        this.systemSettingService = systemSettingService;
    }

    @Async
    @Transactional
    public void generateExplanationAsync(Long questionId) {
        log.info("ExplanationService: Starting async explanation generation for question ID: {}", questionId);

        Optional<Question> questionOpt = questionRepository.findById(questionId);
        if (questionOpt.isEmpty()) {
            log.error("ExplanationService: Question not found with ID: {}", questionId);
            return;
        }

        Question question = questionOpt.get();
        Optional<QuestionAIAnalysis> analysisOpt = aiAnalysisRepository.findFirstByQuestionIdOrderByCreatedAtDesc(questionId);

        QuestionAIAnalysis analysis;
        if (analysisOpt.isPresent()) {
            analysis = analysisOpt.get();
        } else {
            // Create pending placeholder
            analysis = QuestionAIAnalysis.builder()
                    .question(question)
                    .suggestedAnswer("A")
                    .suggestedExplanation("Generating detailed solution derivation...")
                    .confidence(0.5)
                    .modelName("fast-parse")
                    .build();
            analysis = aiAnalysisRepository.save(analysis);
        }

        int maxRetries = 2;
        int attempt = 1;

        while (attempt <= maxRetries) {
            try {
                // Collect images if available
                List<String> imageUrlsOrPaths = new ArrayList<>();
                if (question.getImagePath() != null && !question.getImagePath().isBlank()) {
                    imageUrlsOrPaths.add(question.getImagePath());
                }
                if (question.getOptions() != null) {
                    for (QuestionOption opt : question.getOptions()) {
                        if (opt.getOptionText() != null && (opt.getOptionText().startsWith("/uploads/") || opt.getOptionText().startsWith("http"))) {
                            imageUrlsOrPaths.add(opt.getOptionText());
                        }
                    }
                }

                // Call AI classification service for high-quality mathematical solution
                AIClassificationService.SolutionResult result = aiClassificationService.generateDetailedSolution(
                        question.getText(),
                        analysis.getSuggestedAnswer(),
                        imageUrlsOrPaths
                );

                analysis.setMentorInsights(result.shortSolution);
                analysis.setSuggestedExplanation(result.detailedSolution);
                analysis.setModelName(systemSettingService.getGroqHeavyModel());
                aiAnalysisRepository.save(analysis);

                log.info("ExplanationService: Successfully generated explanation for question ID: {}", questionId);
                return; // Complete

            } catch (Exception e) {
                log.warn("ExplanationService: Failed attempt {} for question ID: {}. Error: {}", attempt, questionId, e.getMessage());

                // Log failure to database
                aiFailureLogRepository.save(AIFailureLog.builder()
                        .questionId(questionId)
                        .modelName(systemSettingService.getGroqFastModel())
                        .promptVersion("v1")
                        .errorMessage(e.getMessage())
                        .retryCount(attempt)
                        .build());

                attempt++;
            }
        }

        // If all retries failed, update status to fallback warning
        analysis.setSuggestedExplanation("### Detailed Solution\n*(Generation failed after " + maxRetries + " attempts. Correct answer is " + analysis.getSuggestedAnswer() + ".)*");
        analysis.setModelName("fallback-failed");
        aiAnalysisRepository.save(analysis);
        log.error("ExplanationService: Explanation generation failed permanently for question ID: {}", questionId);
    }
}
