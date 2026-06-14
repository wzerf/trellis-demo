package com.wshake.infra.config;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nacos 启动失败回归测试（防 IllegalArgumentException: dataId must be specified）。
 *
 * <p>背景：Spring Cloud Alibaba 2025.1.x 引入了 {@code NacosConfigDataLocationResolver}
 * （基于 {@code spring.config.import} 的新机制）。如果声明了 {@code spring.config.import=optional:nacos:}
 * 但<strong>没有</strong>附带 dataId 部分，解析器在 {@code dataIdFor(uri)} 返回空时直接抛
 * {@code IllegalArgumentException("dataId must be specified")}。
 *
 * <p>本项目走"老机制"（{@code spring.cloud.nacos.config.*} + {@code @ConditionalOnProperty}
 * 开关），所以要：
 * <ul>
 *     <li><strong>不</strong>声明 {@code spring.config.import=nacos:...}（避免新机制接管）</li>
 *     <li><strong>显式关</strong> {@code spring.cloud.nacos.config.import-check.enabled=false}（避免新机制检查抛错）</li>
 * </ul>
 *
 * @author wshake
 */
class SpringConfigImportCheckTest {

    @Test
    void applicationYml_disablesNacosImportCheck() throws IOException {
        String content = readClasspathFile("application.yml");

        // 显式关闭新机制的检查（避免 IllegalArgumentException: dataId must be specified）
        assertThat(content)
                .as("application.yml must set spring.cloud.nacos.config.import-check.enabled=false")
                .containsPattern("(?m)import-check:\\s*\\n\\s+enabled:\\s*false");
    }

    @Test
    void applicationYml_doesNotDeclareBareSpringConfigImport() throws IOException {
        String content = readClasspathFile("application.yml");

        // 不要用 `spring.config.import=optional:nacos:` 这种没 dataId 的写法
        // （会触发 NacosConfigDataLocationResolver 抛 IllegalArgumentException）
        assertThat(content)
                .as("application.yml must NOT have spring.config.import without dataId")
                .doesNotContainPattern("(?m)^\\s*import:\\s*[\"']?optional:nacos:[\"']?\\s*$");
    }

    @Test
    void applicationYml_containsNacosConfigEnabledSwitch() throws IOException {
        String content = readClasspathFile("application.yml");

        // nacos.config.enabled 开关存在（Q10 决策）
        assertThat(content)
                .as("application.yml must expose nacos.config.enabled for Q10 toggle")
                .containsPattern("(?m)^\\s*enabled:\\s*\\$\\{NACOS_CONFIG_ENABLED:false\\}");
    }

    @Test
    void applicationYml_appPortDefaultIs4000Block() throws IOException {
        String content = readClasspathFile("application.yml");

        // APP_PORT 默认值必须在 4000 段
        assertThat(content)
                .as("APP_PORT default must be 4080 to avoid 80xx conflicts")
                .containsPattern("(?m)APP_PORT:4080");
    }

    @Test
    void applicationYml_hasExtensionConfigs() throws IOException {
        String content = readClasspathFile("application.yml");

        // 双 dataId 仍在（Q12 决策）
        assertThat(content)
                .as("extension-configs must contain both java-admin.yaml and java-admin-dev.yaml")
                .contains("java-admin.yaml")
                .contains("java-admin-dev.yaml");
    }

    private String readClasspathFile(String path) throws IOException {
        try (InputStream in = getClass().getClassLoader().getResourceAsStream(path)) {
            assertThat(in).as("classpath:" + path + " must exist").isNotNull();
            try (Scanner s = new Scanner(in, StandardCharsets.UTF_8)) {
                return s.useDelimiter("\\A").hasNext() ? s.next() : "";
            }
        }
    }
}
