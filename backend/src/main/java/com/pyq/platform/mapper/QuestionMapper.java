package com.pyq.platform.mapper;

import com.pyq.platform.dto.OptionDTO;
import com.pyq.platform.dto.QuestionDTO;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.QuestionAIAnalysisRepository;
import com.pyq.platform.repository.ExplanationVoteRepository;
import org.springframework.stereotype.Component;
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
        if (question == null) return null;

        List<OptionDTO> options = question.getOptions().stream()
                .map(o -> new OptionDTO(o.getId(), o.getOptionLabel(), o.getOptionText()))
                .collect(Collectors.toList());

        Set<String> tags = question.getTags().stream()
                .map(Tag::getName)
                .collect(Collectors.toSet());

        Optional<QuestionAIAnalysis> aiOpt = aiAnalysisRepository
                .findFirstByQuestionIdOrderByCreatedAtDesc(question.getId());

        long helpful = explanationVoteRepository.countByQuestionIdAndVoteType(question.getId(), ExplanationVote.VoteType.UPVOTE);
        long notHelpful = explanationVoteRepository.countByQuestionIdAndVoteType(question.getId(), ExplanationVote.VoteType.DOWNVOTE);

        return QuestionDTO.builder()
                .id(question.getId())
                .text(question.getText())
                .questionType(question.getQuestionType())
                .difficulty(question.getDifficulty())
                .marks(question.getMarks())
                .negativeMarks(question.getNegativeMarks())
                .year(question.getYear())
                .subjectId(question.getSubject().getId())
                .subjectName(question.getSubject().getName())
                .topicId(question.getTopic().getId())
                .topicName(question.getTopic().getName())
                .isCommunityVerified(question.getIsCommunityVerified())
                .pdfSourceName(question.getPdfSourceName())
                .pdfSourcePath(question.getPdfSourcePath())
                .pdfPageNumber(question.getPdfPageNumber())
                .imagePath(question.getImagePath())
                .status(question.getStatus())
                .options(options)
                .tags(tags)
                // AI related properties
                .aiSuggestedAnswer(aiOpt.map(QuestionAIAnalysis::getSuggestedAnswer).orElse(null))
                .aiSuggestedExplanation(aiOpt.map(QuestionAIAnalysis::getSuggestedExplanation).orElse(null))
                .aiMentorInsights(aiOpt.map(QuestionAIAnalysis::getMentorInsights).orElse(null))
                .questionConfidence(aiOpt.map(QuestionAIAnalysis::getQuestionConfidence).orElse(null))
                .optionsConfidence(aiOpt.map(QuestionAIAnalysis::getOptionsConfidence).orElse(null))
                .answerConfidence(aiOpt.map(QuestionAIAnalysis::getAnswerConfidence).orElse(null))
                .rawAiJson(aiOpt.map(QuestionAIAnalysis::getRawAiJson).orElse(null))
                // Audit / metadata properties
                .publishAt(question.getPublishAt())
                .rawOcrText(question.getRawOcrText())
                .reviewNotes(question.getReviewNotes())
                .verifiedBy(question.getVerifiedBy() != null ? question.getVerifiedBy().getUsername() : null)
                .verifiedAt(question.getVerifiedAt())
                .assignedTo(question.getAssignedTo() != null ? question.getAssignedTo().getUsername() : null)
                // Votes
                .helpfulVotes(helpful)
                .notHelpfulVotes(notHelpful)
                .build();
    }
}
