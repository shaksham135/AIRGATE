package com.pyq.platform.controller;

import com.pyq.platform.entity.GateTip;
import com.pyq.platform.repository.GateTipRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@Slf4j
public class GateTipController {

    private final GateTipRepository tipRepository;

    private static final String[][] DEFAULT_TIPS = {
            { "Motivation", "⚡ AIR 1 is built one question at a time." },
            { "Exam Strategy", "🎯 Target Top 100 in GATE 2027!" },
            { "Algorithms", "💡 Master's Theorem: Compare log_b(a) with k." },
            { "Consistency", "🚀 Daily reps create massive GATE ranks." },
            { "Exam Trick", "🔥 Zero negative marks on NATs—always attempt!" },
            { "Operating Systems", "🧠 SJF Scheduling = Minimum Average Wait Time." },
            { "Mindset", "💪 Consistency beats intensity every single day." },
            { "DBMS", "✨ 3NF with simple keys is automatically BCNF." },
            { "Networks", "⏳ TCP Slow Start: Window doubles every RTT." },
            { "Mindset", "🏆 Champions practice until failure is impossible." },
            { "Compiler", "⚡ LL(1) parsers cannot handle left recursion." },
            { "Accuracy", "🎯 Focus on accuracy—speed follows naturally." },
            { "Digital Logic", "🔥 16:1 MUX needs exactly 4 select lines." },
            { "CoA", "💡 Pipeline Speedup ≈ Number of stages (k)." },
            { "Strategy", "🚀 Turn weak topics into your strongest weapons." },
            { "Operating Systems", "🧠 Banker's Algorithm = Deadlock Avoidance." },
            { "Mindset", "⚡ Master the basics; the rank will follow." },
            { "MSQ Trick", "🎯 Read every option before submitting MSQs." },
            { "Motivation", "💪 Doubt today, derivation tomorrow, Rank 1 soon." },
            { "ToC", "🔥 Regular languages are closed under Kleene Star." },
            { "Dream High", "✨ Push through the struggle—IISc is waiting!" },
            { "Compounding", "⏳ Hard work compounds just like interest." },
            { "Motivation", "🏆 Every PYQ solved brings you closer to IIT." },
            { "Data Structures", "⚡ AVL Tree Height is strictly < 1.44 log2(n)." },
            { "Analysis", "🎯 Analyze your mock test mistakes deeply." },
            { "CoA", "💡 Cache Hit Ratio improves with locality of reference." },
            { "Inspiration", "🚀 You didn't come this far to only come this far." },
            { "Operating Systems", "🧠 Page Fault Rate determines Effective Access Time." },
            { "Data Structures", "⚡ B-Trees keep all leaf nodes at the exact same depth." },
            { "Consistency", "🎯 Small steps daily yield giant GATE results." },
            { "Algorithms", "🔥 Dijkstra's algorithm uses non-negative edge weights." },
            { "Confidence", "💪 Believe in your prep—stay calm under pressure." },
            { "Motivation", "✨ 1 mark can jump your GATE rank by 500 spots!" },
            { "Mindset", "⏳ Practice like you're #2, perform like you're #1." },
            { "Dream High", "🏆 IIT Bombay, IISc, IIT Madras—keep the dream alive!" },
            { "Algorithms", "⚡ Greedy choice property yields optimal MSTs." },
            { "Digital Logic", "🎯 Quick tip: 2's complement of 0 is always 0." },
            { "Operating Systems", "💡 Paging eliminates External Fragmentation completely." },
            { "Exam Strategy", "🚀 Precision over panic—read questions twice." },
            { "Data Structures", "🧠 Topological sort works ONLY on DAGs." },
            { "Algorithms", "⚡ Heapify takes O(n) time, sorting takes O(n log n)." },
            { "Strategy", "🎯 Solve 2-mark questions with laser focus." },
            { "Drive", "🔥 Your competition is resting—keep pushing!" },
            { "Motivation", "💪 Tough times don't last; tough GATE aspirants do." },
            { "CoA", "✨ Maximum frequency = 1 / Clock Period." },
            { "Exam Strategy", "⏳ 100 marks, 65 questions, 3 hours—own it!" },
            { "AIRGATE", "🏆 AIRGATE is with you on every single step." },
            { "Operating Systems", "⚡ Semaphore signal() increments value atomically." },
            { "Focus", "🎯 Keep calm and solve the next question!" },
            { "Motivation", "🚀 Greatness is earned in silent study hours." }
    };

    /**
     * GET /api/tips/active
     * Public endpoint to fetch all active loader tips (auto-seeds default 50 tips
     * if table is empty)
     */
    @GetMapping("/tips/active")
    @org.springframework.cache.annotation.Cacheable(value = "gateTips")
    public ResponseEntity<List<GateTip>> getActiveTips() {
        List<GateTip> tips = tipRepository.findByActiveTrueOrderByCreatedAtDesc();
        if (tips.isEmpty()) {
            seedDefaultTips();
            tips = tipRepository.findByActiveTrueOrderByCreatedAtDesc();
        }
        return ResponseEntity.ok(tips);
    }

    /**
     * GET /api/admin/tips
     * Admin endpoint: fetch all tips (active & inactive)
     */
    @GetMapping("/admin/tips")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<GateTip>> getAllTipsAdmin() {
        List<GateTip> tips = tipRepository.findAllByOrderByCreatedAtDesc();
        if (tips.isEmpty()) {
            seedDefaultTips();
            tips = tipRepository.findAllByOrderByCreatedAtDesc();
        }
        return ResponseEntity.ok(tips);
    }

    /**
     * POST /api/admin/tips
     * Admin endpoint: create a new tip
     */
    @PostMapping("/admin/tips")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = "gateTips", allEntries = true)
    public ResponseEntity<?> createTip(@RequestBody GateTip tip) {
        if (tip.getText() == null || tip.getText().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Tip text cannot be empty."));
        }
        if (tip.getCategory() == null || tip.getCategory().isBlank()) {
            tip.setCategory("General");
        }
        GateTip saved = tipRepository.save(tip);
        return ResponseEntity.ok(saved);
    }

    /**
     * PUT /api/admin/tips/{id}
     * Admin endpoint: update an existing tip
     */
    @PutMapping("/admin/tips/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = "gateTips", allEntries = true)
    public ResponseEntity<?> updateTip(@PathVariable Long id, @RequestBody GateTip updated) {
        GateTip tip = tipRepository.findById(id).orElse(null);
        if (tip == null) {
            return ResponseEntity.notFound().build();
        }
        if (updated.getText() != null && !updated.getText().isBlank()) {
            tip.setText(updated.getText().trim());
        }
        if (updated.getCategory() != null) {
            tip.setCategory(updated.getCategory().trim());
        }
        if (updated.getActive() != null) {
            tip.setActive(updated.getActive());
        }
        GateTip saved = tipRepository.save(tip);
        return ResponseEntity.ok(saved);
    }

    /**
     * DELETE /api/admin/tips/{id}
     * Admin endpoint: delete a tip
     */
    @DeleteMapping("/admin/tips/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @org.springframework.cache.annotation.CacheEvict(value = "gateTips", allEntries = true)
    public ResponseEntity<?> deleteTip(@PathVariable Long id) {
        if (!tipRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        tipRepository.deleteById(id);
        return ResponseEntity.ok(Map.of("success", true, "message", "Tip deleted successfully."));
    }

    /**
     * POST /api/admin/tips/seed
     * Admin endpoint: re-seed 50 default tips
     */
    @PostMapping("/admin/tips/seed")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> seedTipsAdmin() {
        seedDefaultTips();
        return ResponseEntity.ok(Map.of("success", true, "message", "50 Default GATE Tips seeded successfully."));
    }

    private void seedDefaultTips() {
        try {
            for (String[] defaultTip : DEFAULT_TIPS) {
                String cat = defaultTip[0];
                String txt = defaultTip[1];
                tipRepository.save(GateTip.builder()
                        .category(cat)
                        .text(txt)
                        .active(true)
                        .build());
            }
            log.info("💡 [GateTipController] Successfully seeded 50 default GATE CS loader tips!");
        } catch (Exception ex) {
            log.error("Failed to seed default tips: {}", ex.getMessage());
        }
    }
}
