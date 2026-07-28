package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "question_revisions")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionRevision {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "old_text", nullable = false, columnDefinition = "TEXT")
    private String oldText;

    @Column(name = "new_text", nullable = false, columnDefinition = "TEXT")
    private String newText;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "edited_by", nullable = true)
    private User editedBy;

    @Column(name = "edited_at", nullable = true, updatable = false)
    private LocalDateTime editedAt;

    @PrePersist
    protected void onCreate() {
        this.editedAt = LocalDateTime.now();
    }
}
