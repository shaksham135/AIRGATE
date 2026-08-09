package com.pyq.platform.mapper;

import com.pyq.platform.dto.OptionDTO;
import com.pyq.platform.dto.QuestionDTO;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.QuestionAIAnalysisRepository;
import com.pyq.platform.repository.ExplanationVoteRepository;
import com.pyq.platform.util.SubjectSlugUtils;
import org.springframework.stereotype.Component;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class QuestionMapper {

    private final QuestionAIAnalysisRepository aiAnalysisRepository;
    private final ExplanationVoteRepository explanationVoteRepository;

    public QuestionMapper(QuestionAIAnalysisRepository aiAnalysisRepository,
                          ExplanationVoteRepository explanationVoteRepository) {
        this.aiAnalysisRepository = aiAnalysisRepository;
        this.explanationVoteRepository = explanationVoteRepository;
    }

    public QuestionDTO convertToDTO(Question question) {
        return convertToDTO(question, true);
    }

    public QuestionDTO convertToDTOFast(Question question) {
        return convertToDTO(question, false);
    }

    public QuestionDTO convertToDTO(Question question, boolean fetchSubQueries) {
        if (question == null) return null;

        List<OptionDTO> options = question.getOptions() != null ? question.getOptions().stream()
                .sorted(Comparator.comparing(QuestionOption::getOptionLabel, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(o -> new OptionDTO(o.getId(), o.getOptionLabel(), o.getOptionText()))
                .collect(Collectors.toList()) : List.of();

        Set<String> tags = question.getTags() != null ? question.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toSet()) : Set.of();

        String aiSuggestedAnswer = null;
        String aiSuggestedExplanation = null;
        String aiMentorInsights = null;
        Double questionConfidence = null;
        Double optionsConfidence = null;
        Double answerConfidence = null;
        String rawAiJson = null;
        long helpful = 0;
        long notHelpful = 0;

        boolean aiInitialized = org.hibernate.Hibernate.isInitialized(question.getAiAnalyses());
        if (aiInitialized && question.getAiAnalyses() != null && !question.getAiAnalyses().isEmpty()) {
            QuestionAIAnalysis ai = question.getAiAnalyses().get(question.getAiAnalyses().size() - 1);
            aiSuggestedAnswer = ai.getSuggestedAnswer();
            aiSuggestedExplanation = ai.getSuggestedExplanation();
            aiMentorInsights = ai.getMentorInsights();
            questionConfidence = ai.getQuestionConfidence();
            optionsConfidence = ai.getOptionsConfidence();
            answerConfidence = ai.getAnswerConfidence();
            rawAiJson = ai.getRawAiJson();
        } else if (fetchSubQueries) {
            Optional<QuestionAIAnalysis> aiOpt = aiAnalysisRepository
                    .findFirstByQuestionIdOrderByCreatedAtDesc(question.getId());
            if (aiOpt.isPresent()) {
                QuestionAIAnalysis ai = aiOpt.get();
                aiSuggestedAnswer = ai.getSuggestedAnswer();
                aiSuggestedExplanation = ai.getSuggestedExplanation();
                aiMentorInsights = ai.getMentorInsights();
                questionConfidence = ai.getQuestionConfidence();
                optionsConfidence = ai.getOptionsConfidence();
                answerConfidence = ai.getAnswerConfidence();
                rawAiJson = ai.getRawAiJson();
            }
        }

        if (fetchSubQueries) {
            helpful = explanationVoteRepository.countByQuestionIdAndVoteType(question.getId(), ExplanationVote.VoteType.UPVOTE);
            notHelpful = explanationVoteRepository.countByQuestionIdAndVoteType(question.getId(), ExplanationVote.VoteType.DOWNVOTE);
        }

        String subjectName = question.getSubject() != null ? question.getSubject().getName() : null;
        String subjectSlug = SubjectSlugUtils.toSlug(subjectName);
        String branch = question.getBranch() != null && !question.getBranch().isBlank() ? question.getBranch() : "cse";
        Integer paperSet = question.getPaperSet() != null ? question.getPaperSet() : 1;
        Integer questionNumber = question.getQuestionNumber() != null ? question.getQuestionNumber() : (int) (question.getId() % 1000 + 1);

        String pdfSource = question.getPdfSourceName();
        boolean isAiPractice = pdfSource != null && (
                pdfSource.toLowerCase().startsWith("ai_nightly") ||
                pdfSource.toLowerCase().startsWith("ai_generated") ||
                pdfSource.toLowerCase().contains("practice")
        );

        String seoUrl = isAiPractice
                ? "/practice/" + subjectSlug + "/q" + question.getId()
                : "/gate/" + branch + "/" + (question.getYear() != null ? question.getYear() : 2025) + "/set-" + paperSet + "/q" + question.getId();

        return QuestionDTO.builder()
                .id(question.getId())
                .text(question.getText())
                .questionType(question.getQuestionType())
                .difficulty(question.getDifficulty())
                .marks(question.getMarks())
                .negativeMarks(question.getNegativeMarks())
                .year(question.getYear())
                .branch(branch)
                .paperSet(paperSet)
                .questionNumber(questionNumber)
                .seoUrl(seoUrl)
                .subjectSlug(subjectSlug)
                .subjectId(question.getSubject() != null ? question.getSubject().getId() : null)
                .subjectName(subjectName)
                .topicId(question.getTopic() != null ? question.getTopic().getId() : null)
                .topicName(question.getTopic() != null ? question.getTopic().getName() : null)
                .isCommunityVerified(question.getIsCommunityVerified())
                .pdfSourceName(question.getPdfSourceName())
                .pdfSourcePath(question.getPdfSourcePath())
                .pdfPageNumber(question.getPdfPageNumber())
                .imagePath(question.getImagePath())
                .status(question.getStatus())
                .options(options)
                .tags(tags)
                .aiSuggestedAnswer(aiSuggestedAnswer)
                .aiSuggestedExplanation(aiSuggestedExplanation)
                .aiMentorInsights(aiMentorInsights)
                .questionConfidence(questionConfidence)
                .optionsConfidence(optionsConfidence)
                .answerConfidence(answerConfidence)
                .rawAiJson(rawAiJson)
                .publishAt(question.getPublishAt())
                .rawOcrText(question.getRawOcrText())
                .reviewNotes(question.getReviewNotes())
                .verifiedBy(question.getVerifiedBy() != null ? question.getVerifiedBy().getUsername() : null)
                .verifiedAt(question.getVerifiedAt())
                .assignedTo(question.getAssignedTo() != null ? question.getAssignedTo().getUsername() : null)
                .helpfulVotes(helpful)
                .notHelpfulVotes(notHelpful)
                .build();
    }
}
