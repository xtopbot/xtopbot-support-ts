import app from "./app";
import Exception from "./utils/Exception";

app.launch();

//Handle unknown errors
process.on("uncaughtException", function (err) {
  // Handle the error safely
  if (!(err instanceof Exception)) console.error(err);
});

process.on("unhandledRejection", function (err) {
  // Handle the error safely
  if (!(err instanceof Exception)) console.error(err);
});
