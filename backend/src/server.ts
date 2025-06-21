import app from "./app";
import config from "./config/config";
import { appURL } from "./config/app.config";

app.listen(config.port, () => {
  console.log(`Server running on  ${appURL[config.environment]}:${config.port}`);
});
