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

import java.util.Collections;
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

    // Get Comments Tree - Optimized In-Memory Batch Tree Building (Sub-10ms)
    @GetMapping("/questions/{id}/comments")
    public ResponseEntity<List<CommentDTO>> getComments(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {

        Long currentUserId = userDetails != null ? userDetails.getId() : null;

        // 1. Fetch all comments for this question in 1 single query
        List<DiscussionComment> allComments = commentRepository.findByQuestionIdOrderByCreatedAtAsc(id);
        if (allComments.isEmpty()) {
            return ResponseEntity.ok(Collections.emptyList());
        }

        // 2. Fetch all votes for these comments in 1 single query
        List<DiscussionVote> allVotes = voteRepository.findByCommentQuestionId(id);

        // Group votes in memory
        java.util.Map<Long, Long> upvoteCounts = allVotes.stream()
                .filter(v -> "UPVOTE".equalsIgnoreCase(v.getVoteType()))
                .collect(Collectors.groupingBy(v -> v.getComment().getId(), Collectors.counting()));

        java.util.Map<Long, Long> downvoteCounts = allVotes.stream()
                .filter(v -> "DOWNVOTE".equalsIgnoreCase(v.getVoteType()))
                .collect(Collectors.groupingBy(v -> v.getComment().getId(), Collectors.counting()));

        java.util.Map<Long, String> userVotes = new java.util.HashMap<>();
        if (currentUserId != null) {
            allVotes.stream()
                    .filter(v -> currentUserId.equals(v.getUser().getId()))
                    .forEach(v -> userVotes.put(v.getComment().getId(), v.getVoteType()));
        }

        // Group comments by parentCommentId
        java.util.Map<Long, List<DiscussionComment>> repliesMap = allComments.stream()
                .filter(c -> c.getParentComment() != null)
                .collect(Collectors.groupingBy(c -> c.getParentComment().getId()));

        // Filter root comments
        List<DiscussionComment> roots = allComments.stream()
                .filter(c -> c.getParentComment() == null)
                .toList();

        List<CommentDTO> tree = roots.stream()
                .map(c -> buildCommentDTOFast(c, repliesMap, upvoteCounts, downvoteCounts, userVotes))
                .collect(Collectors.toList());

        return ResponseEntity.ok(tree);
    }

    private CommentDTO buildCommentDTOFast(
            DiscussionComment comment,
            java.util.Map<Long, List<DiscussionComment>> repliesMap,
            java.util.Map<Long, Long> upvoteCounts,
            java.util.Map<Long, Long> downvoteCounts,
            java.util.Map<Long, String> userVotes) {

        long upvotes = upvoteCounts.getOrDefault(comment.getId(), 0L);
        long downvotes = downvoteCounts.getOrDefault(comment.getId(), 0L);
        String voteStatus = userVotes.get(comment.getId());

        List<DiscussionComment> replies = repliesMap.getOrDefault(comment.getId(), Collections.emptyList());
        List<CommentDTO> replyDTOs = replies.stream()
                .map(r -> buildCommentDTOFast(r, repliesMap, upvoteCounts, downvoteCounts, userVotes))
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
