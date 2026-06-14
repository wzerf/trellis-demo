package com.wshake.service.entity;

import com.easy.query.core.annotation.Column;
import com.easy.query.core.annotation.EntityProxy;
import com.easy.query.core.annotation.Table;
import com.easy.query.core.proxy.ProxyEntityAvailable;
import com.wshake.service.entity.proxy.SysUserProxy;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 系统用户实体。
 *
 * <p>对齐 v5 部分约定（{@code backend/db/docs/db-conventions.md}）：
 * <ul>
 *     <li>表名：{@code sys_user}（实际 Flyway 脚本中）</li>
 *     <li>主键：{@code BIGINT UNSIGNED}（DB），{@code Long}（Java）</li>
 *     <li>列名：snake_case</li>
 *     <li>字符集：{@code utf8mb4} / 排序规则：{@code utf8mb4_0900_ai_ci}</li>
 *     <li>引擎：{@code InnoDB}</li>
 * </ul>
 *
 * <p>本版本<strong>不</strong>加软删 {@code deleted_at}、{@code is_enabled}、7 字段审计（见 PRD Q5 决策）。
 *
 * <p>Easy-Query 3.2.x：{@link ProxyEntityAvailable} 简化为 marker 接口，{@code SysUserProxy}
 * 由 {@code @EntityProxy} + APT（{@code sql-processor}）自动生成。
 *
 * @author wshake
 */
@Data
@Table("sys_user")
@EntityProxy
public class SysUser implements ProxyEntityAvailable<SysUser, SysUserProxy> {

    @Column(primaryKey = true)
    private Long id;

    private String username;

    private String password;

    private String nickname;

    /** 0=禁用 1=启用 */
    private Integer status;

    private LocalDateTime createTime;

    private LocalDateTime updateTime;
}
