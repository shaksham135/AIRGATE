package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
    name = "discussion_votes",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_discussion_vote_user",
        columnNames = {"comment_id", "user_id"}
    )
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiscussionVote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "comment_id", nullable = false)
    private DiscussionComment comment;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "vote_type", nullable = false, length = 10)
    private String voteType; // UPVOTE, DOWNVOTE
}
