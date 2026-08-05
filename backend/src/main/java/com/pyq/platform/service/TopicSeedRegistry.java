package com.pyq.platform.service;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class TopicSeedRegistry {

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    @Builder
    public static class SeedMatrix {
        private String domainScenario;
        private String subAspect;
        private String parameterConstraints;
    }

    private final Random random = new Random();

    private static final Map<String, List<String>> DOMAINS_BY_SUBJECT = Map.ofEntries(
        Map.entry("Operating System", List.of(
            "Linux Kernel Virtual Memory Subsystem",
            "High-Performance Cloud Hypervisor Manager",
            "Real-Time OS Microcontroller Task Scheduler",
            "PostgreSQL Database Buffer Pool Cache",
            "Multi-Threaded Web Server Thread Pool",
            "NVMe SSD Disk I/O Queue Controller"
        )),
        Map.entry("Databases", List.of(
            "E-Commerce Order Processing & Inventory Schema",
            "Banking Core Transaction & Ledger System",
            "Airline Reservation System Concurrent Sessions",
            "Distributed Key-Value Store B+ Tree Index",
            "Hospital Patient Record Relational Database",
            "Logistics & Supply Chain Warehouse Catalog"
        )),
        Map.entry("Computer Networks", List.of(
            "ISP Autonomous System Border Router (BGP/OSPF)",
            "5G Mobile Core Packet Gateway (GTP/UDP)",
            "High-Frequency Trading Fiber Network Interface",
            "Enterprise Wi-Fi 6 MAC Protocol Layer",
            "CDN Edge Reverse Proxy Cache Server",
            "Data Center Sliding Window TCP Flow Control"
        )),
        Map.entry("Algorithms", List.of(
            "GPS Vehicle Routing & Shortest Path Engine",
            "DNA Sequence Alignment & Dynamic Programming",
            "Network Fiber Optic Minimum Spanning Tree",
            "Cryptographic Hash Table & Binary Search Tree",
            "Huffman Data Compression & Greedy Scheduling",
            "Social Network Community Detection Graph"
        )),
        Map.entry("Programming and Data Structures", List.of(
            "Embedded C Firmware Memory Allocator",
            "Low-Latency Circular Queue Order Buffer",
            "Compiler Abstract Syntax Tree Traversal",
            "Priority Queue Event Simulation Engine",
            "Reentrant Recursive Function Stack Trace",
            "Memory-Mapped Double-Ended Linked List"
        )),
        Map.entry("Computer Organization and Architecture", List.of(
            "RISC-V 5-Stage Pipelined Processor Core",
            "Direct-Mapped & 4-Way Set-Associative CPU Cache",
            "DMA Disk Transfer Controller & Memory Bus",
            "Floating-Point IEEE 754 Arithmetic Logic Unit",
            "32-bit Virtual Address Translation TLB",
            "Microprogrammed Control Unit Instruction Decoder"
        )),
        Map.entry("Theory of Computation", List.of(
            "Network Packet Header Deterministic Finite Automaton (DFA)",
            "Programming Language Compiler NFA-to-DFA Converter",
            "HTML/XML Tag Matcher Pushdown Automaton (PDA)",
            "Turing Machine Decidability & Rice's Theorem Evaluator",
            "Regex Lexical Pattern Matcher Engine",
            "Context-Free Grammar Ambiguity Resolver"
        )),
        Map.entry("Compiler Design", List.of(
            "C Compiler LALR(1) Parsing Table Construction",
            "Static Analysis Control Flow Graph & Dominator Tree",
            "Register Allocation Graph Coloring & SSA Form",
            "Syntax-Directed Translation Expression Evaluator",
            "Lexical Analyzer DFA State Transition Table",
            "Dead Code Elimination & Loop Invariant Motion"
        )),
        Map.entry("Digital Logic", List.of(
            "4-bit Synchronous Up/Down Gray Code Counter",
            "Priority Encoder & 8:1 Multiplexer Logic Tree",
            "K-Map 4-Variable Logic Function Minimizer",
            "Master-Slave JK & D Flip-Flop Frequency Divider",
            "ALU Carry Lookahead Adder Circuit Design",
            "Finite State Machine (Mealy/Moore) Sequence Detector"
        )),
        Map.entry("Discrete Mathematics", List.of(
            "Distributed System Consensus Predicate Logic",
            "Cryptographic RSA Modular Arithmetic & Euler's Function",
            "Planar Graph Chromatic Number & Eulerian Path",
            "Inclusion-Exclusion Principle Combinatorial Counting",
            "Equivalence Relation & Poset Hasse Diagram",
            "Generating Function for Linear Recurrence Relations"
        )),
        Map.entry("Engineering Mathematics", List.of(
            "Matrix Eigenvalue & Singular Value Decomposition",
            "Gauss Elimination & System of Linear Equations",
            "Newton-Raphson & Taylor Series Numerical Approximation",
            "Conditional Probability & Bayes' Theorem Network Reliability",
            "Poisson & Binomial Distribution Event Arrival",
            "Definite Vector Calculus & Double Integration"
        )),
        Map.entry("General Aptitude", List.of(
            "Financial Compound Interest & Profit-Loss Optimization",
            "Speed-Distance-Time Train & Stream Relative Velocity",
            "Pipe-Cistern & Work Efficiency Allocation",
            "Syllogism & Venn Diagram Logical Inference",
            "Permutation & Combination Probability Seating Arrangement",
            "Spatial Pattern Rotation & Cube Unfolding Reasoning"
        ))
    );

    public SeedMatrix getRandomSeed(String subjectName, String topicName) {
        String subjClean = subjectName != null ? subjectName.trim() : "General";
        List<String> domainList = DOMAINS_BY_SUBJECT.getOrDefault(subjClean, List.of(
            "High-Performance Computing Subsystem",
            "Industrial Automation Controller",
            "Distributed Cloud Service Platform"
        ));
        String selectedDomain = domainList.get(random.nextInt(domainList.size()));

        String subAspect = String.format("Analytical evaluation of '%s' focusing on edge cases, boundary parameters, and step-by-step mathematical proof.",
                topicName != null ? topicName : "the core topic");

        String paramConstraints = String.format("Formulate a unique numerical problem. Use distinct realistic values for parameters (e.g. process execution times between 10ms-100ms, matrix sizes between 2x2 to 4x4, probabilities between 0.1 to 0.9). DO NOT mention the word 'seed' or 'token' in the question statement or options!");

        return SeedMatrix.builder()
                .domainScenario(selectedDomain)
                .subAspect(subAspect)
                .parameterConstraints(paramConstraints)
                .build();
    }
}
