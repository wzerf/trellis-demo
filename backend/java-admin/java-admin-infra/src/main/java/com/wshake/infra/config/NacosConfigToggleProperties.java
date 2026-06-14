package com.wshake.infra.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Nacos 启用开关的 {@link ConfigurationProperties} 绑定（Q10 决策）。
 *
 * <p>把 {@code nacos.config.enabled} 提升为可注入的类型安全属性类，作用：
 * <ul>
 *     <li><strong>IDE 可导航</strong>：在 yml 写 {@code nacos.config.enabled}，Ctrl+Click 跳到本类 {@link #enabled} 字段</li>
 *     <li><strong>消除 unknown property warning</strong>：Spring Boot 知道这属性被消费</li>
 *     <li><strong>类型安全</strong>：{@code boolean} 字段有 IDE 推断、自动补全</li>
 * </ul>
 *
 * <p>被 {@link NacosConfig} 的 {@code @ConditionalOnProperty} 用 prefix 引用。
 *
 * @author wshake
 */
@Data
@ConfigurationProperties(prefix = "nacos.config")
public class NacosConfigToggleProperties {

    /**
     * 是否启用 Nacos Config client 装配。
     * <p>默认 {@code false}：dev profile 默认关（不走 Nacos），prod profile 用 env 变量打开。
     */
    private boolean enabled = false;
}
