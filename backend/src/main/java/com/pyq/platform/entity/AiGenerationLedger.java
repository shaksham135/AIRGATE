package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ai_generation_ledger")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiGenerationLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "topic_id", nullable = false)
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Topic topic;

    @Column(nullable = false, length = 20)
    private String difficulty; // EASY, MEDIUM, HARD, GATE_SUPER

    @Column(name = "question_type", nullable = false, length = 10)
    private String questionType; // MCQ, MSQ, NAT

    @Column(name = "total_generated", nullable = false)
    private Integer totalGenerated = 0;

    @Column(name = "total_accepted", nullable = false)
    private Integer totalAccepted = 0;

    @Column(name = "total_rejected", nullable = false)
    private Integer totalRejected = 0;

    @Column(name = "last_generated_at")
    private LocalDateTime lastGeneratedAt;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
