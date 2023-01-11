"use strict";

require("custom-env").env();
import Koa from "koa";
import middleware from "./middleware";
import api from "./api";
const app = new Koa();

app.keys = ["Koa"];
app.use(middleware());
app.use(api());
app.use((ctx) => (ctx.status = 404));

app.on("error", (err, ctx) => {
  /* centralized error handling:
   *   console.log error
   *   write error to log file
   *   save error and request information to database if ctx.request match condition
   *   ...
   */
  console.error(err);
});
export default app;
