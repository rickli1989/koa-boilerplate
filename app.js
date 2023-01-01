"use strict";
import app from "./server";
import { PORT } from "./config";
import services from "./modules/services";
import TradeCommand from "./command/trade";

(async () => {
  try {
    await services.boot(__dirname);

    const cmd = new TradeCommand();
    cmd.execute();

    // const notifier = services.getNotifier();
    // notifier.send("test");
    await app.listen(process.env.PORT || PORT);
    process.once("SIGUSR2", function () {
      console.log("SIGUSR2");
      process.kill(process.pid, "SIGUSR2");
    });

    process.on("SIGINT", function () {
      console.log("SIGINT");
      // this is only called on ctrl+c, not restart
      process.kill(process.pid, "SIGINT");
    });
    console.log(`Server started on port ${process.env.PORT || PORT}`);
  } catch (error) {
    console.log(error);
  }
})();
