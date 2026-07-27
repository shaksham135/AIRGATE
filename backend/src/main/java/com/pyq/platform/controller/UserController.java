package com.pyq.platform.controller;

import com.pyq.platform.entity.User;
import com.pyq.platform.repository.UserRepository;
import com.pyq.platform.security.UserDetailsImpl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;

import com.pyq.platform.repository.LoginHistoryRepository;
import com.pyq.platform.repository.BookmarkRepository;
import com.pyq.platform.repository.UserQuestionSolveRepository;
import com.pyq.platform.entity.LoginHistory;
import com.pyq.platform.entity.Bookmark;
import com.pyq.platform.entity.UserQuestionSolve;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;

import java.util.HashMap;
import java.util.Map;
import java.util.List;

@RestController
@RequestMapping("/api/users")
@Transactional
public class UserController {

    private final UserRepository userRepository;
    private final LoginHistoryRepository loginHistoryRepository;
    private final BookmarkRepository bookmarkRepository;
    private final UserQuestionSolveRepository userQuestionSolveRepository;

    public UserController(UserRepository userRepository,
                          LoginHistoryRepository loginHistoryRepository,
                          BookmarkRepository bookmarkRepository,
                          UserQuestionSolveRepository userQuestionSolveRepository) {
        this.userRepository = userRepository;
        this.loginHistoryRepository = loginHistoryRepository;
        this.bookmarkRepository = bookmarkRepository;
        this.userQuestionSolveRepository = userQuestionSolveRepository;
    }

    @PutMapping("/premium")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> upgradeToPremium(
            @org.springframework.web.bind.annotation.RequestParam(name = "duration", defaultValue = "1") int durationMonths,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        User user = userRepository.findById(userDetails.getId())
                .orElseThrow(() -> new RuntimeException("Error: User not found."));

        int days = 31;
        if (durationMonths == 3) {
            days = 93;
        } else if (durationMonths == 6) {
            days = 186;
        }

        user.setIsPremium(true);
        user.setPremiumExpiresAt(java.time.LocalDateTime.now().plusDays(days));
        userRepository.save(user);

        Map<String, Object> response = new HashMap<>();
        response.put("message", "User upgraded to Aspirant Pro successfully for " + durationMonths + " month(s)!");
        response.put("isPremium", true);
        response.put("premiumExpiresAt", user.getPremiumExpiresAt());

        return ResponseEntity.ok(response);
    }

    @org.springframework.web.bind.annotation.GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getCurrentUserStatus(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        String roleStr = userDetails.getAuthorities().stream()
                .findFirst()
                .map(org.springframework.security.core.GrantedAuthority::getAuthority)
                .orElse("ROLE_USER")
                .replace("ROLE_", "");

        Map<String, Object> response = new HashMap<>();
        response.put("id", userDetails.getId());
        response.put("username", userDetails.getUsername());
        response.put("email", userDetails.getEmail());
        response.put("role", roleStr);
        response.put("isPremium", userDetails.isPremium());
        response.put("premiumExpiresAt", userDetails.getPremiumExpiresAt());
        response.put("isBanned", userDetails.isBanned());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}/details")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> getUserDetails(@PathVariable("id") Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Error: User not found."));

        // 1. Fetch Login History
        List<LoginHistory> logins = loginHistoryRepository.findByUserIdOrderByLoggedInAtDesc(id);
        List<Map<String, Object>> mappedLogins = logins.stream().map(l -> {
            Map<String, Object> m = new HashMap<>();
            m.put("ipAddress", l.getIpAddress());
            m.put("browser", l.getBrowser());
            m.put("operatingSystem", l.getOperatingSystem());
            m.put("deviceType", l.getDeviceType());
            m.put("loggedInAt", l.getLoggedInAt());
            return m;
        }).toList();

        // 2. Fetch Solve History
        List<UserQuestionSolve> solves = userQuestionSolveRepository.findByUserId(id);
        List<Map<String, Object>> mappedSolves = solves.stream().map(s -> {
            Map<String, Object> m = new HashMap<>();
            m.put("questionId", s.getQuestion().getId());
            m.put("questionYear", s.getQuestion().getYear());
            m.put("questionSubject", s.getQuestion().getSubject().getName());
            m.put("isCorrect", s.getIsCorrect());
            m.put("solvedAt", s.getSolvedAt());
            m.put("solvingTimeSeconds", s.getSolvingTimeSeconds());
            return m;
        }).toList();

        // 3. Fetch Bookmarks
        List<Bookmark> bookmarks = bookmarkRepository.findByUserId(id);
        List<Map<String, Object>> mappedBookmarks = bookmarks.stream().map(b -> {
            Map<String, Object> m = new HashMap<>();
            m.put("questionId", b.getQuestion().getId());
            m.put("questionYear", b.getQuestion().getYear());
            m.put("questionSubject", b.getQuestion().getSubject().getName());
            m.put("bookmarkedAt", b.getCreatedAt());
            return m;
        }).toList();

        // 4. Combine into final response
        Map<String, Object> stats = new HashMap<>();
        stats.put("userId", user.getId());
        stats.put("username", user.getUsername());
        stats.put("email", user.getEmail());
        stats.put("role", user.getRole().name());
        stats.put("isPremium", Boolean.TRUE.equals(user.getIsPremium()));
        stats.put("premiumExpiresAt", user.getPremiumExpiresAt());
        stats.put("isBanned", Boolean.TRUE.equals(user.getIsBanned()));
        stats.put("lastActiveAt", user.getLastActiveAt());
        stats.put("createdAt", user.getCreatedAt());
        
        // Streaks
        stats.put("currentStreak", user.getCurrentStreak());
        stats.put("longestStreak", user.getLongestStreak());
        stats.put("lastSolvedDate", user.getLastSolvedDate());

        // Lists
        stats.put("loginHistory", mappedLogins);
        stats.put("solveHistory", mappedSolves);
        stats.put("bookmarks", mappedBookmarks);

        return ResponseEntity.ok(stats);
    }
}
