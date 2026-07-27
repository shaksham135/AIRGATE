package com.pyq.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserAnswerDTO {
    private Long id;
    private Long questionId;
    private Long userId;
    private String username;
    private String submittedAnswer;
    private String explanation;
    private Long upvotes;
    private Long downvotes;
    private Double confidenceScore;
    private String voteStatus; // UPVOTE, DOWNVOTE, or null
    private LocalDateTime createdAt;
}
