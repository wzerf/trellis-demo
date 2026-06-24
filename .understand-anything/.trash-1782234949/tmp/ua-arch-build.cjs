#!/usr/bin/env node
// Build layers.json by looking up exact node IDs from the input
const fs = require('fs');
const input = JSON.parse(fs.readFileSync('/Users/wshake/code/trellis-demo/.understand-anything/tmp/ua-arch-input.json', 'utf-8'));

// Build lookup: filePath+type -> id
const lookup = {};
input.fileNodes.forEach(n => {
  const k = n.type + '|' + n.filePath;
  lookup[k] = n.id;
  // Also store as id -> id for direct lookups
  lookup['id|' + n.id] = n.id;
});

function findId(type, filePath) {
  return lookup[type + '|' + filePath];
}

function findIdByPath(predicate) {
  return input.fileNodes.filter(n => predicate(n.filePath)).map(n => n.id);
}

function findIdByName(name) {
  return input.fileNodes.filter(n => n.name === name).map(n => n.id);
}

const layers = [];

// === layer:root-config ===
const rootConfigIds = [
  // root configs and docs
  'config:.mcp.json',
  'config:Makefile',
  'config:lefthook.yml',
  'config:opencode.jsonc',
  'config:package.json',
  'config:pnpm-workspace.yaml',
  'config:tsconfig.json',
  'document:AGENTS.md',
  'document:CLAUDE.md',
  'document:README.md',
  // root files with file: prefix
  'file:.commitlintrc.js',
  'file:.gitmodules',
  'file:vite.config.ts',
  // java-admin parent build
  'config:backend/java-admin/pom.xml',
  'config:backend/java-admin/build-tools/checkstyle/checkstyle.xml',
  'config:backend/java-admin/build-tools/checkstyle/checkstyle-suppressions.xml',
  'config:backend/java-admin/build-tools/checkstyle/custom-suppressions.xml',
  'config:backend/java-admin/.mvn/jvm.config',
].filter(id => lookup['id|' + id]); // filter to ensure exists

layers.push({
  id: 'layer:root-config',
  name: 'Monorepo 根配置',
  description: '仓库根目录的构建工具链配置（pnpm workspace、Vite+、lefthook、commitlint、Makefile）、Java Admin 父 POM 与 checkstyle 静态检查规则，统一管控整个 monorepo 与 Java 后端的质量门禁。',
  nodeIds: rootConfigIds,
});

// === layer:website-template ===
const wtIds = [
  'file:apps/website-template/index.html',
  'config:apps/website-template/package.json',
  'config:apps/website-template/tsconfig.json',
  'file:apps/website-template/src/counter.ts',
  'file:apps/website-template/src/main.ts',
  'file:apps/website-template/src/style.css',
].filter(id => lookup['id|' + id]);
layers.push({
  id: 'layer:website-template',
  name: 'Vite+ 网站模板',
  description: 'apps/website-template 是 Vite+ 框架的最小网站脚手架，演示 TypeScript 入口、CSS 样式与 HTML 挂载点，作为新前端工程的基线模板。',
  nodeIds: wtIds,
});

// === layer:backend-mock-template ===
const bmIds = input.fileNodes
  .filter(n => n.filePath && n.filePath.startsWith('apps/backend-mock-template/'))
  .map(n => n.id);
layers.push({
  id: 'layer:backend-mock-template',
  name: 'Nitro Mock 后端',
  description: 'apps/backend-mock-template 是基于 Nitro/h3 的 Mock 后端服务，提供鉴权、菜单、用户/部门/角色/字典 CRUD 等端点，配合 faker 生成假数据，配套 JWT/Cookie/时区/响应工具，供前端独立联调使用。',
  nodeIds: bmIds,
});

// === layer:utils-template ===
const utIds = input.fileNodes
  .filter(n => n.filePath && n.filePath.startsWith('packages/utils-template/'))
  .map(n => n.id);
layers.push({
  id: 'layer:utils-template',
  name: '共享工具包',
  description: 'packages/utils-template 是 Vite+ monorepo 内复用的 TypeScript 工具包脚手架，提供 index 入口导出与 Vite Library 模式的构建配置，供各 apps 共享通用逻辑。',
  nodeIds: utIds,
});

// === java-admin-api ===
const apiIds = input.fileNodes.filter(n => n.filePath && n.filePath.includes('java-admin-api/')).map(n => n.id);
layers.push({
  id: 'layer:java-admin-api',
  name: 'Spring Boot API 层',
  description: 'java-admin-api 暴露 HTTP 入口：AuthController 处理登录/登出/当前用户，DTO/VO 定义请求与响应契约，OpenAPI/Swagger 配置生成 Knife4j 文档，Application 启动类以及 dev/prod 环境的多 profile 配置。',
  nodeIds: apiIds,
});

// === java-admin-service ===
const svcIds = input.fileNodes.filter(n => n.filePath && n.filePath.includes('java-admin-service/')).map(n => n.id);
layers.push({
  id: 'layer:java-admin-service',
  name: '领域服务层',
  description: 'java-admin-service 承载核心业务：SysUser 等 Easy-Query 实体、Spring Data 风格的 Repository 接口与 AuthService/SysUserService 业务编排，是 API 层和数据访问之间的领域核心。',
  nodeIds: svcIds,
});

// === java-admin-infra ===
const infraIds = input.fileNodes.filter(n => n.filePath && n.filePath.includes('java-admin-infra/')).map(n => n.id);
layers.push({
  id: 'layer:java-admin-infra',
  name: '基础设施层',
  description: 'java-admin-infra 集中处理横切关注点：GlobalExceptionHandler 统一异常转 Result、TraceIdFilter/RequestLogAspect 串联 traceId 与访问日志、Sa-Token 与 WebConfig 配置鉴权与 CORS、FlywayMigrator 与 NacosConfig 接入配置中心与数据库迁移。',
  nodeIds: infraIds,
});

// === java-admin-common ===
const cmnIds = input.fileNodes.filter(n => n.filePath && n.filePath.includes('java-admin-common/')).map(n => n.id);
layers.push({
  id: 'layer:java-admin-common',
  name: '公共契约层',
  description: 'java-admin-common 定义跨模块复用的契约：Result/ListResult/ObjectResult 统一响应包装、ResultCode 错误码、BizException/AuthException 业务异常基类、Redis/Security 常量与 TraceId 工具，是其他模块的基石。',
  nodeIds: cmnIds,
});

// === java-admin-deploy ===
const depIds = input.fileNodes.filter(n => n.filePath && n.filePath.includes('java-admin/deploy/')).map(n => n.id);
layers.push({
  id: 'layer:java-admin-deploy',
  name: 'Java Admin 部署编排',
  description: 'java-admin 项目的本地开发与运行依赖：docker-compose 编排 MySQL/Redis/Nacos/Adminer 四大容器，.env.example 暴露端口与口令配置，支撑 java-admin-api/infra 的 dev profile 启动。',
  nodeIds: depIds,
});

// === db-design ===
const dbIds = input.fileNodes.filter(n => {
  if (!n.filePath) return false;
  if (n.filePath === 'backend/db/schema.sql') return true;
  if (n.filePath.startsWith('backend/db/docs/')) return true;
  return false;
}).map(n => n.id);
layers.push({
  id: 'layer:db-design',
  name: '数据库设计与文档',
  description: 'backend/db 沉淀 java-admin 的数据库总体设计：schema.sql 描述 23 张表（RBAC、菜单、字典、i18n、Temporal、日志归档），docs 目录提供命名约定、ER 关系与字段速查手册，是后端各模块迁移的源头。',
  nodeIds: dbIds,
});

// === Validation ===
const assigned = new Set();
layers.forEach(l => l.nodeIds.forEach(id => assigned.add(id)));
const allInputIds = new Set(input.fileNodes.map(n => n.id));
const unassigned = [...allInputIds].filter(id => !assigned.has(id));
const invented = [...assigned].filter(id => !allInputIds.has(id));
const total = layers.reduce((s, l) => s + l.nodeIds.length, 0);

console.log('Total layers: ' + layers.length);
console.log('Sum of nodeIds: ' + total);
console.log('Input file nodes: ' + allInputIds.size);
console.log('Unassigned: ' + unassigned.length);
if (unassigned.length) unassigned.forEach(id => console.log('  ' + id));
console.log('Invented: ' + invented.length);
if (invented.length) invented.forEach(id => console.log('  ' + id));
console.log();
layers.forEach(l => console.log('  ' + l.id + ' (' + l.name + '): ' + l.nodeIds.length));

fs.writeFileSync('/Users/wshake/code/trellis-demo/.understand-anything/intermediate/layers.json', JSON.stringify(layers, null, 2));
console.log('\nWrote layers.json');
