package com.pyq.platform.controller;

import com.pyq.platform.dto.MessageResponse;
import com.pyq.platform.entity.User;
import com.pyq.platform.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.pyq.platform.security.UserDetailsImpl;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize("hasRole('ADMIN')")
@Transactional
public class AdminUserController {

    private final UserRepository userRepository;

    public AdminUserController(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // Get all users
    @GetMapping
    public ResponseEntity<List<User>> getAllUsers() {
        List<User> users = userRepository.findAll();
        return ResponseEntity.ok(users);
    }

    // Grant / Revoke user premium status (admin)
    @PostMapping("/{id}/premium")
    @org.springframework.cache.annotation.CacheEvict(value = "userDetails", allEntries = true)
    public ResponseEntity<?> togglePremium(
            @PathVariable("id") Long id,
            @RequestParam(name = "duration", defaultValue = "1") int durationMonths) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: User not found!"));
        }

        User user = userOpt.get();
        boolean target = !(user.getIsPremium() != null && user.getIsPremium());
        user.setIsPremium(target);
        if (target) {
            // Compute expiry based on requested duration
            int days = durationMonths == 3 ? 93 : durationMonths == 6 ? 186 : 31;
            user.setPremiumExpiresAt(java.time.LocalDateTime.now().plusDays(days));
        } else {
            user.setPremiumExpiresAt(null);
        }
        userRepository.save(user);

        String msg = target
                ? "Aspirant Pro granted for " + durationMonths + " month(s). Expires: " + user.getPremiumExpiresAt()
                : "Aspirant Pro revoked for user: " + user.getUsername();
        return ResponseEntity.ok(new MessageResponse(msg));
    }

    // Toggle user banned status (penalty/ban)
    @PostMapping("/{id}/ban")
    @org.springframework.cache.annotation.CacheEvict(value = "userDetails", allEntries = true)
    public ResponseEntity<?> toggleBan(@PathVariable("id") Long id, @AuthenticationPrincipal UserDetailsImpl adminDetails) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: User not found!"));
        }

        User user = userOpt.get();
        if (user.getId().equals(adminDetails.getId())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: You cannot ban yourself!"));
        }

        // Toggle ban status
        user.setIsBanned(user.getIsBanned() == null ? true : !user.getIsBanned());
        userRepository.save(user);

        return ResponseEntity.ok(new MessageResponse("User ban status updated. Banned: " + user.getIsBanned()));
    }

    // Delete a user
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable("id") Long id, @AuthenticationPrincipal UserDetailsImpl adminDetails) {
        Optional<User> userOpt = userRepository.findById(id);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new MessageResponse("Error: User not found!"));
        }

        User user = userOpt.get();
        if (user.getId().equals(adminDetails.getId())) {
            return ResponseEntity.badRequest()
                    .body(new MessageResponse("Error: You cannot delete yourself!"));
        }

        userRepository.delete(user);
        return ResponseEntity.ok(new MessageResponse("User '" + user.getUsername() + "' deleted successfully!"));
    }
}
