package com.wshake.service.user;

import com.wshake.common.exception.AuthException;
import com.wshake.service.entity.SysUser;
import com.wshake.service.repository.SysUserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * {@link AuthService} 单元测试。
 *
 * <p>用 Mockito 隔离 {@link SysUserRepository}，不连真实 DB。
 *
 * @author wshake
 */
@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    SysUserRepository sysUserRepository;

    @InjectMocks
    AuthService authService;

    @Test
    void login_withCorrectCredentials_returnsUser() {
        SysUser user = fixture("admin", "$2a$10$valid", "Admin", 1);
        when(sysUserRepository.findByUsername("admin")).thenReturn(user);

        // BCrypt checkpw of "admin123" against this hash returns true
        // (using a real BCrypt hash to avoid mock complexity)
        // We'll just verify the lookup was performed and other paths below.

        // For a deterministic test, use a hash generated for "admin123"
        // Hash generated at test time using sa-token BCrypt
        SysUser userWithValidHash = fixture("admin",
                cn.dev33.satoken.secure.BCrypt.hashpw("admin123"),
                "Admin", 1);
        when(sysUserRepository.findByUsername("admin")).thenReturn(userWithValidHash);

        SysUser result = authService.login("admin", "admin123");

        assertThat(result).isNotNull();
        assertThat(result.getUsername()).isEqualTo("admin");
        verify(sysUserRepository).findByUsername("admin");
    }

    @Test
    void login_withWrongPassword_throwsAuthInvalidCredentials() {
        SysUser user = fixture("admin", cn.dev33.satoken.secure.BCrypt.hashpw("admin123"), "Admin", 1);
        when(sysUserRepository.findByUsername("admin")).thenReturn(user);

        assertThatThrownBy(() -> authService.login("admin", "wrong"))
                .isInstanceOf(AuthException.class)
                .extracting("code").isEqualTo(2002);
    }

    @Test
    void login_userNotFound_throwsAuthInvalidCredentials() {
        when(sysUserRepository.findByUsername("nobody")).thenReturn(null);

        assertThatThrownBy(() -> authService.login("nobody", "any"))
                .isInstanceOf(AuthException.class)
                .extracting("code").isEqualTo(2002);

        verify(sysUserRepository).findByUsername("nobody");
    }

    @Test
    void login_userDisabled_throwsAuthForbidden() {
        SysUser disabled = fixture("admin",
                cn.dev33.satoken.secure.BCrypt.hashpw("admin123"),
                "Admin", 0);
        when(sysUserRepository.findByUsername("admin")).thenReturn(disabled);

        assertThatThrownBy(() -> authService.login("admin", "admin123"))
                .isInstanceOf(AuthException.class)
                .extracting("code").isEqualTo(2004);
    }

    @Test
    void login_blankUsername_throwsAuthInvalidCredentialsWithoutRepoCall() {
        assertThatThrownBy(() -> authService.login("", "any"))
                .isInstanceOf(AuthException.class)
                .extracting("code").isEqualTo(2002);

        verify(sysUserRepository, never()).findByUsername(any());
    }

    @Test
    void login_blankPassword_throwsAuthInvalidCredentialsWithoutRepoCall() {
        assertThatThrownBy(() -> authService.login("admin", ""))
                .isInstanceOf(AuthException.class)
                .extracting("code").isEqualTo(2002);

        verify(sysUserRepository, never()).findByUsername(any());
    }

    private static SysUser fixture(String username, String password, String nickname, int status) {
        SysUser u = new SysUser();
        u.setId(1L);
        u.setUsername(username);
        u.setPassword(password);
        u.setNickname(nickname);
        u.setStatus(status);
        u.setCreateTime(LocalDateTime.now());
        u.setUpdateTime(LocalDateTime.now());
        return u;
    }

    private static <T> T any() {
        return org.mockito.ArgumentMatchers.any();
    }
}
