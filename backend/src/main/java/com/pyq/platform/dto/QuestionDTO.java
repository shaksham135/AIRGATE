package com.pyq.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;
import java.util.Set;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionDTO {
    private Long id;
    private String text;
    private String questionType;
    private String difficulty;
    private Integer marks;
    private Double negativeMarks;
    private Integer year;
    private String branch;
    private Integer paperSet;
    private Integer questionNumber;
    private String seoUrl;
    private String subjectSlug;
    private Long subjectId;
    private String subjectName;
    private Long topicId;
    private String topicName;
    private Boolean isCommunityVerified;
    private String pdfSourceName;
    private String pdfSourcePath;
    private Integer pdfPageNumber;
    private String imagePath;
    private String status;
    private List<OptionDTO> options;
    private Set<String> tags;
    private String aiSuggestedAnswer;
    private String aiSuggestedExplanation;
    private String aiMentorInsights;

    private java.time.LocalDateTime publishAt;
    private String rawOcrText;
    private String reviewNotes;
    private String verifiedBy;
    private java.time.LocalDateTime verifiedAt;
    private String assignedTo;

    private Double questionConfidence;
    private Double optionsConfidence;
    private Double answerConfidence;
    private String rawAiJson;

    private Long helpfulVotes;
    private Long notHelpfulVotes;
}
