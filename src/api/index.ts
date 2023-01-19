import * as compose from "koa-compose";
import * as Router from "@koa/router";

const importDir = require("directory-import");

export default function api() {
  const routes = importDir("./routes");
  const router: Router = new Router({ prefix: "/api" });

  Object.keys(routes).forEach((name) => {
    if (!name.endsWith("index.ts")) return routes[name].default(router);
  });

  return compose([router.routes(), router.allowedMethods()]);
}
