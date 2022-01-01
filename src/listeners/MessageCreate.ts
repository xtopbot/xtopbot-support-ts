import { Message } from "discord.js";
import CommandHandler from "../commands/CommandHandler";
import Logger from "../utils/Logger";

export default class MessageCreate {
  public static async onMessageCreate(message: Message) {
    try {
      await CommandHandler.onCommand(message);
    } catch (err) {
      Logger.error(
        `[App](Event: ${this.constructor.name}) Error while execute: ${
          (err as Error).message
        }`
      );

      console.error(err);
    }
  }
}
