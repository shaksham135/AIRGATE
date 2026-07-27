package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "answer_votes",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_answer_vote_user",
        columnNames = {"user_answer_id", "user_id"}
    )
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AnswerVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_answer_id", nullable = false)
    private UserAnswer userAnswer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "vote_type", nullable = false, length = 10)
    private String voteType; // UPVOTE, DOWNVOTE
}
