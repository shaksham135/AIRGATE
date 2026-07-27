package com.pyq.platform.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import java.io.IOException;

@Slf4j
public class AuthTokenFilter extends OncePerRequestFilter {

    private final JwtUtils jwtUtils;
    private final UserDetailsServiceImpl userDetailsService;
    private final com.pyq.platform.repository.UserRepository userRepository;
    private final com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository;
    private final java.util.Map<Long, java.time.LocalDateTime> activeUsersCache = new java.util.concurrent.ConcurrentHashMap<>();

    private static final long SETTINGS_CACHE_TTL_MS = 30_000;
    private static volatile com.pyq.platform.entity.SystemSettings cachedSystemSettings = null;
    private static volatile long lastSettingsFetchTime = 0;

    private com.pyq.platform.entity.SystemSettings getCachedSettings() {
        long now = System.currentTimeMillis();
        if (cachedSystemSettings == null || (now - lastSettingsFetchTime) > SETTINGS_CACHE_TTL_MS) {
            try {
                cachedSystemSettings = systemSettingsRepository.findById(1).orElse(null);
                lastSettingsFetchTime = now;
            } catch (Exception ex) {
                log.warn("Failed to refresh cached SystemSettings: {}", ex.getMessage());
            }
        }
        return cachedSystemSettings;
    }

    public AuthTokenFilter(JwtUtils jwtUtils, 
                           UserDetailsServiceImpl userDetailsService, 
                           com.pyq.platform.repository.UserRepository userRepository,
                           com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository) {
        this.jwtUtils = jwtUtils;
        this.userDetailsService = userDetailsService;
        this.userRepository = userRepository;
        this.systemSettingsRepository = systemSettingsRepository;
    }

    private static final java.util.Map<String, UserDetailsCacheEntry> userDetailsRamCache = new java.util.concurrent.ConcurrentHashMap<>();

    private static class UserDetailsCacheEntry {
        final UserDetails userDetails;
        final long timestamp;
        UserDetailsCacheEntry(UserDetails userDetails, long timestamp) {
            this.userDetails = userDetails;
            this.timestamp = timestamp;
        }
    }

    public static void evictUserFromRamCache(String username) {
        if (username != null) {
            userDetailsRamCache.remove(username);
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = parseJwt(request);
            if (jwt != null && jwtUtils.validateJwtToken(jwt)) {
                String username = jwtUtils.getUsernameFromJwtToken(jwt);
                
                long nowMs = System.currentTimeMillis();
                UserDetailsCacheEntry cacheEntry = userDetailsRamCache.get(username);
                UserDetails userDetails;
                if (cacheEntry != null && (nowMs - cacheEntry.timestamp < 300_000)) { // 5 mins RAM TTL
                    userDetails = cacheEntry.userDetails;
                } else {
                    userDetails = userDetailsService.loadUserByUsername(username);
                    userDetailsRamCache.put(username, new UserDetailsCacheEntry(userDetails, nowMs));
                }
                
                UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                        userDetails, null, userDetails.getAuthorities());
                authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                SecurityContextHolder.getContext().setAuthentication(authentication);

                // Non-blocking throttled update of lastActiveAt field (once per 30 minutes)
                if (userDetails instanceof UserDetailsImpl) {
                    Long userId = ((UserDetailsImpl) userDetails).getId();
                    java.time.LocalDateTime now = java.time.LocalDateTime.now();
                    java.time.LocalDateTime lastTracked = activeUsersCache.get(userId);
                    if (lastTracked == null || lastTracked.isBefore(now.minusMinutes(30))) {
                        activeUsersCache.put(userId, now);
                        java.util.concurrent.CompletableFuture.runAsync(() -> {
                            try {
                                userRepository.updateLastActiveAt(userId, now);
                            } catch (Exception ex) {
                                log.error("Failed to update last active timestamp: {}", ex.getMessage());
                            }
                        });
                    }
                }
            }
        } catch (Exception e) {
            log.error("Cannot set user authentication: {}", e.getMessage());
        }

        // Maintenance Mode Guard with 30-second RAM Caching (zero DB latency)
        try {
            String path = request.getRequestURI();
            boolean isApi = path.startsWith("/api/");
            boolean isPublicAuth = path.startsWith("/api/auth/") || path.equals("/api/admin/settings");
            if (isApi && !isPublicAuth) {
                com.pyq.platform.entity.SystemSettings settings = getCachedSettings();
                if (settings != null && Boolean.TRUE.equals(settings.getIsMaintenanceMode())) {
                    // Check if authenticated user is admin or editor
                    boolean isAdminOrEditor = false;
                    org.springframework.security.core.Authentication auth = SecurityContextHolder.getContext().getAuthentication();
                    if (auth != null && auth.isAuthenticated() && auth.getPrincipal() instanceof UserDetailsImpl) {
                        UserDetailsImpl impl = (UserDetailsImpl) auth.getPrincipal();
                        String role = impl.getAuthorities().stream()
                                .findFirst()
                                .map(r -> r.getAuthority())
                                .orElse("");
                        if ("ROLE_ADMIN".equals(role) || "ROLE_EDITOR".equals(role)) {
                            isAdminOrEditor = true;
                        }
                    }
                    if (!isAdminOrEditor) {
                        response.setStatus(503); // Service Unavailable
                        response.setContentType("application/json");
                        response.getWriter().write("{\"error\": \"Website is currently under maintenance. Please try again later.\"}");
                        return; // Halt request processing
                    }
                }
            }
        } catch (Exception ex) {
            log.error("Maintenance check error: {}", ex.getMessage());
        }

        filterChain.doFilter(request, response);
    }

    private String parseJwt(HttpServletRequest request) {
        String headerAuth = request.getHeader("Authorization");
        if (StringUtils.hasText(headerAuth) && headerAuth.startsWith("Bearer ")) {
            return headerAuth.substring(7);
        }
        return null;
    }
}
