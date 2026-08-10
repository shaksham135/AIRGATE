package com.pyq.platform.config;

import com.pyq.platform.security.AuthTokenFilter;
import com.pyq.platform.security.JwtUtils;
import com.pyq.platform.security.UserDetailsServiceImpl;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final UserDetailsServiceImpl userDetailsService;
    private final JwtUtils jwtUtils;

    @Value("${cors.allowed-origins:http://localhost:3000,http://localhost:5173}")
    private String corsAllowedOrigins;

    @Value("${cors.allowed-methods:GET,POST,PUT,DELETE,OPTIONS,PATCH}")
    private String corsAllowedMethods;

    @Value("${cors.allowed-headers:Authorization,Content-Type,Cache-Control}")
    private String corsAllowedHeaders;

    @Value("${cors.allow-credentials:true}")
    private boolean corsAllowCredentials;

    @Value("${server.ssl.enabled:false}")
    private boolean sslEnabled;

    private final com.pyq.platform.repository.UserRepository userRepository;
    private final com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository;

    public SecurityConfig(UserDetailsServiceImpl userDetailsService, 
                          JwtUtils jwtUtils, 
                          com.pyq.platform.repository.UserRepository userRepository,
                          com.pyq.platform.repository.SystemSettingsRepository systemSettingsRepository) {
        this.userDetailsService = userDetailsService;
        this.jwtUtils = jwtUtils;
        this.userRepository = userRepository;
        this.systemSettingsRepository = systemSettingsRepository;
    }

    @Bean
    public AuthTokenFilter authenticationJwtTokenFilter() {
        return new AuthTokenFilter(jwtUtils, userDetailsService, userRepository, systemSettingsRepository);
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider() {
        DaoAuthenticationProvider authProvider = new DaoAuthenticationProvider();
        authProvider.setUserDetailsService(userDetailsService);
        authProvider.setPasswordEncoder(passwordEncoder());
        return authProvider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(Arrays.asList(corsAllowedOrigins.split(",")));
        configuration.setAllowedMethods(Arrays.asList(corsAllowedMethods.split(",")));
        configuration.setAllowedHeaders(Collections.singletonList("*")); // Allow all headers for robust preflight support
        configuration.setExposedHeaders(Collections.singletonList("Authorization"));
        configuration.setAllowCredentials(corsAllowCredentials);
        configuration.setMaxAge(86400L);
        
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.cors(cors -> cors.configurationSource(corsConfigurationSource()))
            .csrf(csrf -> csrf.disable())
            .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .headers(headers -> headers
                .frameOptions(frame -> frame.deny()) // Anti-Clickjacking protection
                .xssProtection(xss -> xss.disable()) // Modern browser CSP XSS Protection
                .contentTypeOptions(contentType -> {}) // Prevent MIME-sniffing attacks
                .referrerPolicy(referrer -> referrer.policy(org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
            );
        if (sslEnabled) {
            http.requiresChannel(channel -> channel
                .requestMatchers(r -> r.getRequestURI().startsWith("/api")).requiresSecure());
        }

        http.authorizeHttpRequests(auth -> auth
                // Allow all CORS preflight OPTIONS & Uptime HEAD requests
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .requestMatchers(HttpMethod.HEAD, "/**").permitAll()
                // Public Health Check Endpoints (UptimeRobot, Pingdom, Render health checks)
                .requestMatchers("/health", "/api/public/health", "/api/public/**", "/actuator/health").permitAll()
                // Public Auth Endpoints
                .requestMatchers("/api/auth/**").permitAll()
                // Public static files & SEO sitemaps
                .requestMatchers("/uploads/**").permitAll()
                .requestMatchers("/sitemap.xml", "/robots.txt").permitAll()
                // Actuator admin endpoints
                .requestMatchers("/actuator/**").hasRole("ADMIN")
                // Anonymous Read-Only Access (allowing both base path and sub-paths)
                .requestMatchers(HttpMethod.GET, "/api/subjects", "/api/subjects/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/topics", "/api/topics/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/questions", "/api/questions/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/practice/questions", "/api/practice/questions/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/payments/pricing").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/payments/webhook").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/banners/active").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/tips/active").permitAll()
                .requestMatchers(HttpMethod.POST, "/api/coupons/validate").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/discussions", "/api/discussions/**").permitAll()
                .requestMatchers(HttpMethod.GET, "/api/admin/settings/public-meta").permitAll()
                // All other operations require login
                .anyRequest().authenticated()
            );

        http.authenticationProvider(authenticationProvider());
        http.addFilterBefore(authenticationJwtTokenFilter(), UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
