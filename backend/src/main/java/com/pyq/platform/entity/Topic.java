package com.pyq.platform.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "topics", indexes = {
    @Index(name = "idx_topic_subject", columnList = "subject_id"),
    @Index(name = "idx_topic_parent", columnList = "parent_topic_id"),
    @Index(name = "idx_topic_name", columnList = "name")
})
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Topic {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id", nullable = false)
    private Subject subject;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_topic_id")
    @com.fasterxml.jackson.annotation.JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "parentTopic"})
    private Topic parentTopic;
}
