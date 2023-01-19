import * as dotenv from "dotenv";
dotenv.config();
import * as Koa from "koa";
import middleware from "./middleware";
import api from "./api";
import auth from "./auth";

const app = new Koa();

app.keys = [process.env.APP_KEY || "annalise.ai"];
app.use(auth()); //Authentication strategies
app.use(middleware()); //Middleware
app.use(api()); //Api routes
app.use((ctx) => (ctx.status = 404));

app.on("error", (err, ctx) => {
  /* centralized error handling:
   *   console.log error
   *   write error to log file
   *   save error and request information to database or to ELK
   *   ...
   */
  // console.error(err);
});

export default app;
