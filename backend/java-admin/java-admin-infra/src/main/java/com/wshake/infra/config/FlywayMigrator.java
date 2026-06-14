package com.wshake.infra.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.Location;
import org.flywaydb.core.api.configuration.FluentConfiguration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.jdbc.DataSourceBuilder;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;

/**
 * Flyway 迁移触发器（手动执行）。
 *
 * <p>Spring Boot 4 + Flyway 10.x 的自动装配在我们环境下不触发（log 中无任何 Flyway 输出）。
 * 改用 {@link ApplicationRunner} 显式调用 {@link Flyway#migrate()}，绕开自动装配。
 *
 * <p>profile=prod 改用 {@code db/migration-prod} 目录（不含 V2 种子数据）；
 * profile=dev 用 {@code db/migration} 目录（含 V1 + V2）。
 *
 * @author wshake
 */
@Slf4j
@Component
@Order(0)   // 在业务 ApplicationRunner 之前
@RequiredArgsConstructor
public class FlywayMigrator implements ApplicationRunner {

    @Value("${spring.datasource.url}")
    private String jdbcUrl;

    @Value("${spring.datasource.username}")
    private String username;

    @Value("${spring.datasource.password:}")
    private String password;

    @Value("${spring.profiles.active:dev}")
    private String activeProfile;

    @Override
    public void run(ApplicationArguments args) {
        String location = "dev".equals(activeProfile)
                ? "classpath:db/migration"
                : "classpath:db/migration-prod";
        log.info("[FLYWAY] starting migration: profile={} url={} location={}",
                activeProfile, jdbcUrl, location);

        try {
            DataSource ds = DataSourceBuilder.create()
                    .url(jdbcUrl)
                    .username(username)
                    .password(password == null ? "" : password)
                    .build();

            FluentConfiguration cfg = Flyway.configure()
                    .dataSource(ds)
                    .locations(new Location(location))
                    .baselineOnMigrate(true)
                    .baselineVersion("0")
                    .validateOnMigrate(true);
            Flyway flyway = new Flyway(cfg);
            int applied = flyway.migrate().migrationsExecuted;
            log.info("[FLYWAY] migration complete: {} migration(s) applied", applied);
        } catch (Exception e) {
            log.error("[FLYWAY] migration FAILED: {}", e.getMessage(), e);
            throw e;
        }
    }
}
