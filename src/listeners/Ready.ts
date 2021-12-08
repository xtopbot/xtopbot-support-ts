import { Client } from "discord.js";
import Logger from "../utils/Logger";

export default class Ready {
  public static onReady(client: Client) {
    Logger.info(`[Discord] <${client?.user?.tag}>Bot connected!`);
  }
}
