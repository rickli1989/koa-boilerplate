import app from "./app";

(async () => {
  try {
    await app.listen(process.env.PORT);
    console.log(`Server started on port ${process.env.PORT}`);
  } catch (error) {
    console.log(error);
  }
})();
