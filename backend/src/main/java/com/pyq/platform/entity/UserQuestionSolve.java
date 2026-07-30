package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_question_solves", uniqueConstraints = {
    @UniqueConstraint(name = "uk_user_question_solve", columnNames = {"user_id", "question_id"})
}, indexes = {
    @Index(name = "idx_uqs_user", columnList = "user_id"),
    @Index(name = "idx_uqs_question", columnList = "question_id"),
    @Index(name = "idx_uqs_user_correct", columnList = "user_id, is_correct")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserQuestionSolve {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "selected_option", nullable = false)
    private String selectedOption;

    @Column(name = "is_correct", nullable = false)
    private Boolean isCorrect;

    @Column(name = "solving_time_seconds")
    private Integer solvingTimeSeconds;

    @Column(name = "solved_at", nullable = false)
    private LocalDateTime solvedAt;

    @PrePersist
    @PreUpdate
    protected void onSave() {
        this.solvedAt = LocalDateTime.now();
    }
}
