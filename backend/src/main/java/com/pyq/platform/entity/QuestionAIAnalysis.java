package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "question_ai_analysis")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QuestionAIAnalysis {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "suggested_answer", nullable = false, length = 100)
    private String suggestedAnswer;

    @Column(name = "suggested_explanation", columnDefinition = "TEXT")
    private String suggestedExplanation;

    @Column(name = "mentor_insights", columnDefinition = "TEXT")
    private String mentorInsights;

    @Column(nullable = false)
    private Double confidence;

    @Column(name = "question_confidence")
    private Double questionConfidence;

    @Column(name = "options_confidence")
    private Double optionsConfidence;

    @Column(name = "answer_confidence")
    private Double answerConfidence;

    @Column(name = "raw_ai_json", columnDefinition = "TEXT")
    private String rawAiJson;

    @Column(name = "prompt_version", length = 20)
    private String promptVersion;

    @Column(name = "temperature")
    private Double temperature;

    @Column(name = "top_p")
    private Double topP;

    @Column(name = "model_name", nullable = false, length = 50)
    private String modelName; // e.g., llama-3.1-8b-instant, llama-3.3-70b-versatile

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
    }
}
