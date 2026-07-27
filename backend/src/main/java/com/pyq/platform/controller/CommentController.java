package com.pyq.platform.controller;

import com.pyq.platform.dto.CommentDTO;
import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.DiscussionCommentRepository;
import com.pyq.platform.repository.DiscussionVoteRepository;
import com.pyq.platform.repository.QuestionRepository;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api")
@Transactional
public class CommentController {

    private final DiscussionCommentRepository commentRepository;
    private final DiscussionVoteRepository voteRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public CommentController(DiscussionCommentRepository commentRepository, DiscussionVoteRepository voteRepository,
                             QuestionRepository questionRepository, UserRepository userRepository) {
        this.commentRepository = commentRepository;
        this.voteRepository = voteRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    // Post Comment
    @PostMapping("/questions/{id}/comments")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> postComment(
            @PathVariable("id") Long id,
            @RequestBody CommentDTO requestDto,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        User user = userRepository.findById(userDetails.getId()).orElseThrow();
        
        DiscussionComment parent = null;
        if (requestDto.getParentCommentId() != null) {
            parent = commentRepository.findById(requestDto.getParentCommentId()).orElse(null);
        }

        DiscussionComment comment = DiscussionComment.builder()
                .question(questionOpt.get())
                .parentComment(parent)
                .user(user)
                .commentText(requestDto.getCommentText())
                .build();

        commentRepository.save(comment);
        return ResponseEntity.status(HttpStatus.CREATED).body(new MessageResponse("Comment posted successfully!"));
    }

    // Get Comments Tree
    @GetMapping("/questions/{id}/comments")
    public ResponseEntity<List<CommentDTO>> getComments(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        Long currentUserId = userDetails != null ? userDetails.getId() : null;
        List<DiscussionComment> roots = commentRepository.findByQuestionIdAndParentCommentIsNullOrderByCreatedAtAsc(id);
        
        List<CommentDTO> tree = roots.stream()
                .map(c -> buildCommentDTO(c, currentUserId))
                .collect(Collectors.toList());

        return ResponseEntity.ok(tree);
    }

    private CommentDTO buildCommentDTO(DiscussionComment comment, Long currentUserId) {
        long upvotes = voteRepository.countByCommentIdAndVoteType(comment.getId(), "UPVOTE");
        long downvotes = voteRepository.countByCommentIdAndVoteType(comment.getId(), "DOWNVOTE");

        String voteStatus = null;
        if (currentUserId != null) {
            Optional<DiscussionVote> voteOpt = voteRepository.findByCommentIdAndUserId(comment.getId(), currentUserId);
            if (voteOpt.isPresent()) {
                voteStatus = voteOpt.get().getVoteType();
            }
        }

        // Fetch replies recursively
        List<DiscussionComment> replies = commentRepository.findByParentCommentIdOrderByCreatedAtAsc(comment.getId());
        List<CommentDTO> replyDTOs = replies.stream()
                .map(r -> buildCommentDTO(r, currentUserId))
                .collect(Collectors.toList());

        return CommentDTO.builder()
                .id(comment.getId())
                .questionId(comment.getQuestion().getId())
                .parentCommentId(comment.getParentComment() != null ? comment.getParentComment().getId() : null)
                .userId(comment.getUser().getId())
                .username(comment.getUser().getUsername())
                .commentText(comment.getCommentText())
                .upvotes(upvotes)
                .downvotes(downvotes)
                .voteStatus(voteStatus)
                .createdAt(comment.getCreatedAt())
                .replies(replyDTOs)
                .build();
    }

    // Vote Comment
    @PostMapping("/comments/{id}/vote")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> voteComment(
            @PathVariable("id") Long id,
            @RequestParam("type") String voteType,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        if (!voteType.equals("UPVOTE") && !voteType.equals("DOWNVOTE")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid vote type!"));
        }

        Optional<DiscussionComment> commentOpt = commentRepository.findById(id);
        if (commentOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Comment not found!"));
        }

        DiscussionComment comment = commentOpt.get();
        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        Optional<DiscussionVote> existingVoteOpt = voteRepository.findByCommentIdAndUserId(id, user.getId());

        if (existingVoteOpt.isPresent()) {
            DiscussionVote existing = existingVoteOpt.get();
            if (existing.getVoteType().equals(voteType)) {
                voteRepository.delete(existing);
            } else {
                existing.setVoteType(voteType);
                voteRepository.save(existing);
            }
        } else {
            voteRepository.save(DiscussionVote.builder()
                    .comment(comment)
                    .user(user)
                    .voteType(voteType)
                    .build());
        }

        return ResponseEntity.ok(new MessageResponse("Vote logged successfully!"));
    }
}
