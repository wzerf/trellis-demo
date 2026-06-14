package com.wshake.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

/**
 * java-admin 应用入口。
 *
 * <p>唯一带 {@code @SpringBootApplication} 的模块。
 *
 * @author wshake
 */
@SpringBootApplication
@ComponentScan(basePackages = {
        "com.wshake.api",
        "com.wshake.infra",
        "com.wshake.service",
        "com.wshake.common"
})
public class Application {

    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
