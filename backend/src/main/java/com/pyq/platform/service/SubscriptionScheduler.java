package com.pyq.platform.service;

import com.pyq.platform.entity.User;
import com.pyq.platform.repository.UserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@Slf4j
public class SubscriptionScheduler {

    private final UserRepository userRepository;

    public SubscriptionScheduler(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    // Runs every 5 minutes (300,000 milliseconds) to revoke expired plans
    @Scheduled(fixedDelay = 300000)
    @Transactional
    public void revokeExpiredSubscriptions() {
        log.debug("SubscriptionScheduler: Scanning for expired Aspirant Pro subscriptions...");
        List<User> expiredUsers = userRepository.findByIsPremiumTrueAndPremiumExpiresAtBefore(LocalDateTime.now());
        if (!expiredUsers.isEmpty()) {
            for (User u : expiredUsers) {
                u.setIsPremium(false);
                u.setPremiumExpiresAt(null);
                userRepository.save(u);
                log.info("SubscriptionScheduler: Revoked expired Aspirant Pro status for user: {}", u.getUsername());
            }
        }
    }
}
