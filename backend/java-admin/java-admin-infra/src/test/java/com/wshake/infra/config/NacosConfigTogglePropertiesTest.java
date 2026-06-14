package com.wshake.infra.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@code nacos.config.enabled} IDE-navigable 验证。
 *
 * <p>背景：之前是 {@code @ConditionalOnProperty(name = "nacos.config.enabled", havingValue = "true")}，
 * IDE 找不到跳转目标（"unknown property" 警告）。
 *
 * <p>修法：{@link NacosConfigToggleProperties} 加 {@code @ConfigurationProperties(prefix = "nacos.config")}。
 * IDE 现在能 Ctrl+Click 跳到 {@code enabled} 字段，Spring Boot 知道属性被消费（无 unknown 警告）。
 *
 * <p>本测试验证：
 * <ol>
 *     <li>{@code NacosConfigToggleProperties} 存在并标了 {@code @ConfigurationProperties}</li>
 *     <li>前缀恰好是 {@code nacos.config}</li>
 *     <li>{@code NacosConfig} 用了 {@code @EnableConfigurationProperties(NacosConfigToggleProperties.class)}</li>
 *     <li>{@code @ConditionalOnProperty} 改用 prefix-based 写法引用 {@code enabled}</li>
 * </ol>
 */
class NacosConfigTogglePropertiesTest {

    @Test
    void toggleProperties_classExistsAndAnnotated() throws IOException {
        String content = readFile(
                "src/main/java/com/wshake/infra/config/NacosConfigToggleProperties.java");

        assertThat(content)
                .as("NacosConfigToggleProperties must exist with @ConfigurationProperties")
                .contains("@ConfigurationProperties")
                .contains("prefix = \"nacos.config\"")
                .contains("private boolean enabled");
    }

    @Test
    void nacosConfig_usesEnableConfigurationProperties() throws IOException {
        String content = readFile("src/main/java/com/wshake/infra/config/NacosConfig.java");

        assertThat(content)
                .as("NacosConfig must use @EnableConfigurationProperties(NacosConfigToggleProperties.class)")
                .contains("@EnableConfigurationProperties(NacosConfigToggleProperties.class)")
                .doesNotContain("name = \"nacos.config.enabled\"")    // 旧写法
                .containsPattern("prefix\\s*=\\s*\"nacos\\.config\"")    // 新 prefix 写法
                .containsPattern("name\\s*=\\s*\"enabled\"");
    }

    @Test
    void applicationYml_keepsNacosEnabledToggle() throws IOException {
        String content = readFile("../java-admin-api/src/main/resources/application.yml");

        // 仍然要保留 nacos.config.enabled 占位符（被 @ConfigurationProperties 消费）
        assertThat(content)
                .as("application.yml must still have nacos.config.enabled with NACOS_CONFIG_ENABLED placeholder")
                .containsPattern("(?m)^nacos:\\s*\\n\\s+config:\\s*\\n\\s+enabled:\\s*\\$\\{NACOS_CONFIG_ENABLED:false\\}");
    }

    private String readFile(String path) throws IOException {
        File f = new File(path);
        assertThat(f).as("file " + path + " (cwd=" + new File(".").getAbsolutePath() + ")").exists();
        try (InputStream in = new FileInputStream(f)) {
            try (Scanner s = new Scanner(in, StandardCharsets.UTF_8)) {
                return s.useDelimiter("\\A").hasNext() ? s.next() : "";
            }
        }
    }
}
