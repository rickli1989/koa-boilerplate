import { PrismaService } from "../src/lib";
// import server from "../src/app";

module.exports = async () => {
  console.info("Setting up ...");
  try {
    // global.__SERVER__ = await server.listen(3001);
    await PrismaService.cleanDb();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};
