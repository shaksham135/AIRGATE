package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.dto.UserAnswerDTO;
import com.pyq.platform.entity.*;
import com.pyq.platform.repository.*;
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

@RestController
@RequestMapping("/api")
@Transactional
public class AnswerController {

    private final UserAnswerRepository userAnswerRepository;
    private final AnswerVoteRepository answerVoteRepository;
    private final QuestionRepository questionRepository;
    private final UserRepository userRepository;

    public AnswerController(UserAnswerRepository userAnswerRepository, AnswerVoteRepository answerVoteRepository,
                            QuestionRepository questionRepository, UserRepository userRepository) {
        this.userAnswerRepository = userAnswerRepository;
        this.answerVoteRepository = answerVoteRepository;
        this.questionRepository = questionRepository;
        this.userRepository = userRepository;
    }

    // Submit Answer & Explanation
    @PostMapping("/questions/{id}/answers")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> submitAnswer(
            @PathVariable("id") Long id,
            @RequestBody UserAnswerDTO requestDto,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        Optional<Question> questionOpt = questionRepository.findById(id);
        if (questionOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Question not found!"));
        }

        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        UserAnswer answer = UserAnswer.builder()
                .question(questionOpt.get())
                .user(user)
                .submittedAnswer(requestDto.getSubmittedAnswer())
                .explanation(requestDto.getExplanation())
                .build();

        userAnswerRepository.save(answer);

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(new MessageResponse("Answer and explanation submitted successfully!"));
    }

    // Get Answers for Question
    @GetMapping("/questions/{id}/answers")
    public ResponseEntity<List<UserAnswerDTO>> getAnswers(
            @PathVariable("id") Long id,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        List<Object[]> results = userAnswerRepository.findAnswersWithScoresByQuestionId(id);
        List<UserAnswerDTO> dtos = new ArrayList<>();

        Long currentUserId = userDetails != null ? userDetails.getId() : null;

        for (Object[] row : results) {
            UserAnswer ua = (UserAnswer) row[0];
            
            long upvotes = answerVoteRepository.countByUserAnswerIdAndVoteType(ua.getId(), "UPVOTE");
            long downvotes = answerVoteRepository.countByUserAnswerIdAndVoteType(ua.getId(), "DOWNVOTE");
            long totalVotes = upvotes + downvotes;
            double consensus = totalVotes > 0 ? (double) upvotes / totalVotes : 0.0;

            String voteStatus = null;
            if (currentUserId != null) {
                Optional<AnswerVote> voteOpt = answerVoteRepository.findByUserAnswerIdAndUserId(ua.getId(), currentUserId);
                if (voteOpt.isPresent()) {
                    voteStatus = voteOpt.get().getVoteType();
                }
            }

            dtos.add(UserAnswerDTO.builder()
                    .id(ua.getId())
                    .questionId(ua.getQuestion().getId())
                    .userId(ua.getUser().getId())
                    .username(ua.getUser().getUsername())
                    .submittedAnswer(ua.getSubmittedAnswer())
                    .explanation(ua.getExplanation())
                    .upvotes(upvotes)
                    .downvotes(downvotes)
                    .confidenceScore(consensus)
                    .voteStatus(voteStatus)
                    .createdAt(ua.getCreatedAt())
                    .build());
        }

        return ResponseEntity.ok(dtos);
    }

    // Vote on User Answer / Explanation
    @PostMapping("/answers/{id}/vote")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> voteAnswer(
            @PathVariable("id") Long id,
            @RequestParam("type") String voteType,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        
        if (!voteType.equals("UPVOTE") && !voteType.equals("DOWNVOTE")) {
            return ResponseEntity.badRequest().body(new MessageResponse("Error: Invalid vote type!"));
        }

        Optional<UserAnswer> answerOpt = userAnswerRepository.findById(id);
        if (answerOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: Answer not found!"));
        }

        UserAnswer answer = answerOpt.get();
        User user = userRepository.findById(userDetails.getId()).orElseThrow();

        Optional<AnswerVote> existingVoteOpt = answerVoteRepository.findByUserAnswerIdAndUserId(id, user.getId());

        if (existingVoteOpt.isPresent()) {
            AnswerVote existing = existingVoteOpt.get();
            if (existing.getVoteType().equals(voteType)) {
                // If clicked again, remove vote (toggle logic)
                answerVoteRepository.delete(existing);
            } else {
                // Change vote type
                existing.setVoteType(voteType);
                answerVoteRepository.save(existing);
            }
        } else {
            // Create new vote
            answerVoteRepository.save(AnswerVote.builder()
                    .userAnswer(answer)
                    .user(user)
                    .voteType(voteType)
                    .build());
        }

        // Re-evaluate Question consensus
        evaluateConsensus(answer.getQuestion());

        return ResponseEntity.ok(new MessageResponse("Vote logged successfully!"));
    }

    private void evaluateConsensus(Question question) {
        List<UserAnswer> answers = userAnswerRepository.findByQuestionId(question.getId());
        
        boolean verified = false;

        for (UserAnswer ua : answers) {
            long upvotes = answerVoteRepository.countByUserAnswerIdAndVoteType(ua.getId(), "UPVOTE");
            long downvotes = answerVoteRepository.countByUserAnswerIdAndVoteType(ua.getId(), "DOWNVOTE");
            long totalVotes = upvotes + downvotes;

            if (totalVotes >= 10) {
                double consensus = (double) upvotes / totalVotes;
                if (consensus >= 0.80) {
                    verified = true;
                    break;
                }
            }
        }

        if (question.getIsCommunityVerified() != verified) {
            question.setIsCommunityVerified(verified);
            questionRepository.save(question);
        }
    }
}
