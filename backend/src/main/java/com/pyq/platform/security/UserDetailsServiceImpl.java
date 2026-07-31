package com.pyq.platform.security;

import com.pyq.platform.entity.User;
import com.pyq.platform.repository.UserRepository;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    public UserDetailsServiceImpl(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    /**
     * Cached for 5 minutes (TTL configured in application.properties).
     * Eliminates a DB round-trip on every authenticated API request.
     * Cache is evicted whenever a user's critical fields (role, ban status) change.
     */
    @Override
    @Transactional(readOnly = true)
    @Cacheable(value = "userDetails", key = "#username")
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByUsernameOrEmail(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with username or email: " + username));
        return UserDetailsImpl.build(user);
    }

    /**
     * Call this after any operation that changes role, ban-status, or premium status
     * so the stale cached entry is invalidated immediately.
     */
    @CacheEvict(value = "userDetails", key = "#username")
    public void evictUserCache(String username) {
        // Spring handles eviction — no body needed.
    }
}
