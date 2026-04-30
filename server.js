import { createAppServer } from "./shared/appServer.js";

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";

const server = createAppServer();

server.listen(PORT, HOST, () => {
  console.log(`App pronta em http://${HOST}:${PORT}`);
});
