const fsExtra = require("fs-extra");
import * as path from "path";
module.exports = async () => {
  console.info("Closing up ...");

  try {
    // (global.__SERVER__ as any).close();
    fsExtra.emptyDirSync(path.join(__dirname, "../src/assets/upload"));
    fsExtra.emptyDirSync(path.join(__dirname, "../src/assets/download"));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
