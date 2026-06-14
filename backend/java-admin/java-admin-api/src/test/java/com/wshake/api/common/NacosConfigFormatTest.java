package com.wshake.api.common;

import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Scanner;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Nacos Config 配置格式回归测试。
 *
 * <p>基于 {@code nacos-config-spring-boot-starter 0.2.2+} 的元数据：
 * <ul>
 *     <li>公共 server 配在 {@code spring.cloud.nacos.*}，{@code config.*} 自动继承</li>
 *     <li>{@code extension-configs} 用 kebab-case：{@code data-id} / {@code refresh-enabled}</li>
 *     <li>不写 {@code fail-fast} / {@code retry}（starter 内置降级）</li>
 *     <li>启用开关走 {@code nacos.config.enabled} + {@code NACOS_CONFIG_ENABLED} 占位</li>
 * </ul>
 *
 * <p>测试运行 cwd = {@code backend/java-admin/java-admin-api}（module 根）。
 *
 * @author wshake
 */
class NacosConfigFormatTest {

    @Test
    void applicationYml_usesTopLevelNacosServerConfig() throws IOException {
        String content = readFile("src/main/resources/application.yml");

        // 公共 server 配置必须在 spring.cloud.nacos.* 顶层（不在 config.* 下重复）
        assertThat(content)
                .as("server-addr must be at spring.cloud.nacos level (config.* auto-inherits)")
                .containsPattern("(?m)^\\s+server-addr:\\s*\\$\\{NACOS_SERVER_ADDR");
        assertThat(content)
                .as("username must be at spring.cloud.nacos level (not in config.* block)")
                .containsPattern("(?m)^\\s+username:\\s*\\$\\{NACOS_USER");
        assertThat(content)
                .as("password must be at spring.cloud.nacos level (not in config.* block)")
                .containsPattern("(?m)^\\s+password:\\s*\\$\\{NACOS_PASSWORD");

        // config.* 块下不应有 server-addr（避免重复）
        assertThat(content)
                .as("config.* block must NOT have server-addr (inherited from parent)")
                .doesNotContainPattern("(?m)^\\s+config:\\s*\\n(?:\\s+#.*\\n|\\s+\\w+:.*\\n)*\\s+server-addr:");
    }

    @Test
    void applicationYml_extensionConfigs_usesKebabCase() throws IOException {
        String content = readFile("src/main/resources/application.yml");

        // extension-configs 必须用 data-id（kebab-case），不是 dataId
        assertThat(content)
                .as("extension-configs must use kebab-case 'data-id' (per starter metadata)")
                .containsPattern("(?m)^\\s+-\\s+data-id:\\s+java-admin");
        assertThat(content)
                .as("extension-configs must use kebab-case 'refresh-enabled' (per starter metadata)")
                .containsPattern("(?m)^\\s+refresh-enabled:\\s+true");
        // 不能用 camelCase 旧名
        assertThat(content)
                .as("extension-configs must NOT use camelCase 'dataId' (kebab-case required)")
                .doesNotContainPattern("(?m)^\\s+-\\s+dataId:");
        assertThat(content)
                .as("extension-configs must NOT use camelCase 'refresh:' (kebab-case required)")
                .doesNotContainPattern("(?m)^\\s+refresh:\\s+true");
    }

    @Test
    void applicationYml_doesNotHaveRedundantFailFastOrRetry() throws IOException {
        String content = readFile("src/main/resources/application.yml");

        // fail-fast / retry 是 starter 内置降级，不应手写
        assertThat(content)
                .as("config.* must NOT have fail-fast (starter handles degradation)")
                .doesNotContainPattern("(?m)^\\s+fail-fast:");
        assertThat(content)
                .as("config.* must NOT have retry block (starter handles retry)")
                .doesNotContainPattern("(?m)^\\s+retry:\\s*$");
    }

    @Test
    void applicationYml_hasNacosEnabledToggle() throws IOException {
        String content = readFile("src/main/resources/application.yml");

        // 必须有可插拔开关（nacos.config.enabled + NACOS_CONFIG_ENABLED 占位）
        assertThat(content)
                .as("must have nacos.config.enabled with NACOS_CONFIG_ENABLED placeholder")
                .containsPattern("(?m)^nacos:\\s*\\n\\s+config:\\s*\\n\\s+enabled:\\s*\\$\\{NACOS_CONFIG_ENABLED:false\\}");
    }

    @Test
    void applicationDevYml_doesNotOverrideNacosConfig() throws IOException {
        String content = readFile("src/main/resources/application-dev.yml");

        // dev yml 不应有 nacos.config（统一在 application.yml 控制）
        assertThat(content)
                .as("dev yml must NOT override nacos.* config (single source in application.yml)")
                .doesNotContainPattern("(?m)^nacos:");
    }

    @Test
    void applicationYml_doesNotHaveJackson2Config() throws IOException {
        String content = readFile("src/main/resources/application.yml");

        // Jackson 2.x 旧枚举值在 Jackson 3.x（tools.jackson）已废弃
        assertThat(content)
                .as("application.yml must NOT configure jackson.serialization.write-bigdecimal-as-plain")
                .doesNotContainPattern("(?m)^\\s+serialization:\\s*\\n\\s+write-bigdecimal-as-plain:");
        assertThat(content)
                .as("application.yml must NOT configure jackson.deserialization.use-big-decimal-for-floats")
                .doesNotContainPattern("(?m)^\\s+deserialization:\\s*\\n\\s+use-big-decimal-for-floats:");
    }

    /**
     * 从 module 根（cwd）读文件。api 模块的测试运行 cwd = backend/java-admin/java-admin-api。
     */
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
