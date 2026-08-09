package com.pyq.platform.security;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.pyq.platform.entity.User;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import java.util.Collection;
import java.util.Collections;
import java.util.Objects;

public class UserDetailsImpl implements UserDetails {
    private static final long serialVersionUID = 1L;

    private Long id;
    private String username;
    private String email;

    @JsonIgnore
    private String password;

    private Collection<? extends GrantedAuthority> authorities;

    private boolean isBanned;
    private boolean isPremium;
    private boolean hasUsedPdfTrial;
    private java.time.LocalDateTime premiumExpiresAt;

    public UserDetailsImpl(Long id, String username, String email, String password,
                           Collection<? extends GrantedAuthority> authorities, boolean isBanned, boolean isPremium,
                           boolean hasUsedPdfTrial,
                           java.time.LocalDateTime premiumExpiresAt) {
        this.id = id;
        this.username = username;
        this.email = email;
        this.password = password;
        this.authorities = authorities;
        this.isBanned = isBanned;
        this.isPremium = isPremium;
        this.hasUsedPdfTrial = hasUsedPdfTrial;
        this.premiumExpiresAt = premiumExpiresAt;
    }

    public static UserDetailsImpl build(User user) {
        SimpleGrantedAuthority authority = new SimpleGrantedAuthority("ROLE_" + user.getRole().name());
        return new UserDetailsImpl(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getPasswordHash(),
                Collections.singletonList(authority),
                Boolean.TRUE.equals(user.getIsBanned()),
                Boolean.TRUE.equals(user.getIsPremium()),
                Boolean.TRUE.equals(user.getHasUsedPdfTrial()),
                user.getPremiumExpiresAt()
        );
    }

    public boolean isPremium() {
        return isPremium;
    }

    public boolean isHasUsedPdfTrial() {
        return hasUsedPdfTrial;
    }

    public boolean isBanned() {
        return isBanned;
    }

    public java.time.LocalDateTime getPremiumExpiresAt() {
        return premiumExpiresAt;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return authorities;
    }

    @Override
    public String getPassword() {
        return password;
    }

    @Override
    public String getUsername() {
        return username;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return !isBanned;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return !isBanned;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o)
            return true;
        if (o == null || getClass() != o.getClass())
            return false;
        UserDetailsImpl user = (UserDetailsImpl) o;
        return Objects.equals(id, user.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
