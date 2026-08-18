package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "mock_attempts")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MockAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnore
    private User user;

    @Column(name = "started_at", nullable = false)
    private LocalDateTime startedAt;

    @Column(name = "submitted_at", nullable = false)
    private LocalDateTime submittedAt;

    @Column(name = "time_taken_seconds", nullable = false)
    private Integer timeTakenSeconds;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions;

    @Column(name = "correct_count", nullable = false)
    @Builder.Default
    private Integer correctCount = 0;

    @Column(name = "incorrect_count", nullable = false)
    @Builder.Default
    private Integer incorrectCount = 0;

    @Column(name = "skipped_count", nullable = false)
    @Builder.Default
    private Integer skippedCount = 0;

    @Column(nullable = false)
    @Builder.Default
    private Double score = 0.0;

    @Column(name = "negative_wastage", nullable = false)
    @Builder.Default
    private Double negativeWastage = 0.0;

    @Column(name = "auto_submitted", nullable = false)
    @Builder.Default
    private Boolean autoSubmitted = false;

    @Column(name = "mode", length = 50)
    private String mode;

    @Column(name = "estimated_rank")
    private Integer estimatedRank;

    @Column(name = "percentile")
    private Double percentile;

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<MockAttemptAnswer> answers = new ArrayList<>();
}
