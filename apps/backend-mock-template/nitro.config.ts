import errorHandler from "./error";

process.env.COMPATIBILITY_DATE = new Date().toISOString();
export default defineNitroConfig({
  devErrorHandler: errorHandler,
  errorHandler: "~/error",
  // 显式固定 dev 端口，便于前端 Vite 代理（端口在 package.json 的 start 脚本中通过 --port 设置）
  devProxy: {},
  routeRules: {
    "/api/**": {
      cors: true,
      headers: {
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Headers":
          "Accept, Authorization, Content-Length, Content-Type, If-Match, If-Modified-Since, If-None-Match, If-Unmodified-Since, X-CSRF-TOKEN, X-Requested-With",
        "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
        // Allow-Origin 由 middleware/1.api.ts 动态回显 Origin；
        // 不能同时给 "*" + Allow-Credentials，浏览器会拒绝带 cookie 的请求
        "Access-Control-Expose-Headers": "*",
      },
    },
  },
});
