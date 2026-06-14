package com.wshake.service.repository;

import com.easy.query.api.proxy.client.EasyEntityQuery;
import com.wshake.service.entity.SysUser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 系统用户 Repository。
 *
 * <p>基于 Easy-Query 的 {@link EasyEntityQuery} 实现；不引入 Spring Data 接口。
 *
 * @author wshake
 */
@Component
@RequiredArgsConstructor
public class SysUserRepository {

    private final EasyEntityQuery easyEntityQuery;

    /**
     * 根据用户名查询用户。
     *
     * @param username 用户名
     * @return 用户实体，未找到返回 {@code null}
     */
    public SysUser findByUsername(String username) {
        return easyEntityQuery.queryable(SysUser.class)
                .where(u -> u.username().eq(username))
                .firstOrNull();
    }

    /**
     * 根据 ID 查询用户。
     *
     * @param id 主键
     * @return 用户实体，未找到返回 {@code null}
     */
    public SysUser findById(Long id) {
        return easyEntityQuery.queryable(SysUser.class)
                .where(u -> u.id().eq(id))
                .firstOrNull();
    }
}
