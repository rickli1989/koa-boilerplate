"use strict";

import Koa from "koa";
import middleware from "./middleware";
import api from "./api";
const app = new Koa();

app.keys = ["IG"];
app.use(middleware());
app.use(api());
app.use((ctx) => (ctx.status = 404));
// app.use(async (ctx, next) => {
//   try {
//     await next();
//   } catch (err) {
//     ctx.status = err.status || 500;
//     ctx.body = err.message;
//     ctx.app.emit("error", err, ctx);
//   }
// });

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
