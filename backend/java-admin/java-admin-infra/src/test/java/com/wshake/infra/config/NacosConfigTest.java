package com.wshake.infra.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link NacosConfig} 单元测试（Q10 决策）。
 *
 * <p>验证：
 * <ul>
 *     <li>{@code nacos.config.enabled=false}（默认）：{@code NacosConfig} bean <strong>不</strong>被创建</li>
 *     <li>{@code nacos.config.enabled=true}：{@code NacosConfig} bean 被创建</li>
 * </ul>
 *
 * <p>注意：本测试不启动完整 Spring 上下文（避免 Nacos 自动装配依赖 Nacos 服务）。
 * 仅验证 {@code @ConditionalOnProperty} 行为。
 *
 * @author wshake
 */
class NacosConfigTest {

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(NacosConfig.class)
            .withPropertyValues("spring.main.web-application-type=none");

    @Test
    void nacosConfig_disabledByDefault() {
        runner.withPropertyValues("nacos.config.enabled=false")
                .run(ctx -> assertThat(ctx).doesNotHaveBean(NacosConfig.class));
    }

    @Test
    void nacosConfig_enabledWhenFlagTrue() {
        runner.withPropertyValues("nacos.config.enabled=true")
                .run(ctx -> assertThat(ctx).hasSingleBean(NacosConfig.class));
    }

    @Test
    void nacosConfig_absentWhenPropertyNotSet() {
        runner.run(ctx -> assertThat(ctx).doesNotHaveBean(NacosConfig.class));
    }
}
