import Router from "@koa/router";
import { Context } from "koa";

export default (router: Router) => {
  router.get("/ping", async (ctx: Context) => {
    ctx.body = {
      server: "running",
    };
  });
};
