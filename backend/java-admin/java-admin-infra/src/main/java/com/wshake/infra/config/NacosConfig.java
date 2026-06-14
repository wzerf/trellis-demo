package com.wshake.infra.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Nacos Config 条件装配（Q10 决策）。
 *
 * <p>当 {@code nacos.config.enabled=true} 时本配置类被激活；starter 通过
 * {@code spring.cloud.nacos.config.*} 自动装配 config client，<strong>无需</strong>我们手工写 bean。
 *
 * <p>属性 {@code nacos.config.enabled} 由 {@link NacosConfigToggleProperties} 绑定（IDE 可导航）。
 *
 * @author wshake
 */
@Configuration
@EnableConfigurationProperties(NacosConfigToggleProperties.class)
@ConditionalOnProperty(prefix = "nacos.config", name = "enabled", havingValue = "true")
public class NacosConfig {
    // 占位。starter 通过 spring.cloud.nacos.config.* 自动装配。
}
