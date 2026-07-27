package com.pyq.platform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CommentDTO {
    private Long id;
    private Long questionId;
    private Long parentCommentId;
    private Long userId;
    private String username;
    private String commentText;
    private Long upvotes;
    private Long downvotes;
    private String voteStatus;
    private LocalDateTime createdAt;
    private List<CommentDTO> replies;
}
