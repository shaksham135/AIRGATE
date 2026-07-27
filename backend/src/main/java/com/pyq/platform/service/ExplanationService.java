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

    public ExplanationService(QuestionRepository questionRepository,
                              QuestionAIAnalysisRepository aiAnalysisRepository,
                              AIFailureLogRepository aiFailureLogRepository,
                              AIClassificationService aiClassificationService) {
        this.questionRepository = questionRepository;
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.aiFailureLogRepository = aiFailureLogRepository;
        this.aiClassificationService = aiClassificationService;
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
        if (analysisOpt.isEmpty()) {
            log.error("ExplanationService: AI Analysis record not found for question ID: {}", questionId);
            return;
        }

        QuestionAIAnalysis analysis = analysisOpt.get();

        // Collect images from question body and options
        List<String> imageUrlsOrPaths = new ArrayList<>();
        String questionImg = question.getImagePath();
        if (questionImg != null && !questionImg.trim().isEmpty()) {
            imageUrlsOrPaths.add(questionImg);
        }
        if (question.getOptions() != null) {
            for (QuestionOption opt : question.getOptions()) {
                String optText = opt.getOptionText();
                if (optText != null && (optText.startsWith("/uploads/") || optText.startsWith("http://") || optText.startsWith("https://"))) {
                    imageUrlsOrPaths.add(optText);
                }
            }
        }

        int attempt = 1;
        int maxRetries = 2; // Fast model attempt, then fallback to heavy model

        while (attempt <= maxRetries) {
            try {
                // Call AI service to generate solution
                AIClassificationService.SolutionResult result = aiClassificationService.generateDetailedSolution(
                        question.getText(),
                        analysis.getSuggestedAnswer(),
                        imageUrlsOrPaths
                );

                analysis.setMentorInsights(result.shortSolution);
                analysis.setSuggestedExplanation(result.detailedSolution);
                analysis.setModelName("llama-3.1-8b-comprehensive");
                aiAnalysisRepository.save(analysis);

                log.info("ExplanationService: Successfully generated explanation for question ID: {}", questionId);
                return; // Complete

            } catch (Exception e) {
                log.warn("ExplanationService: Failed attempt {} for question ID: {}. Error: {}", attempt, questionId, e.getMessage());

                // Log failure to database
                aiFailureLogRepository.save(AIFailureLog.builder()
                        .questionId(questionId)
                        .modelName(attempt == 1 ? "llama-3.1-8b" : "llama-3.2-11b-vision")
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
