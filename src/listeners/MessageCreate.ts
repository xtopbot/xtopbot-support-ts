import { Message } from "discord.js";
import CommandHandler from "../commands/CommandHandler";
import InteractionOnly from "../plugins/InteractionOnly";
import Logger from "../utils/Logger";

export default class MessageCreate {
  public static async onMessageCreate(message: Message): Promise<void> {
    MessageCreate.commandHandle(message);
    MessageCreate.interactionOnlyPlugin(message);
  }

  private static async commandHandle(message: Message) {
    if (message.author.bot) return;
    try {
      await CommandHandler.process(message);
    } catch (err) {
      Logger.error(
        `[App](Event: ${this.constructor.name}) Error while execute: ${
          (err as Error).message
        }`
      );

      console.error(err);
    }
  }

  private static async interactionOnlyPlugin(message: Message) {
    try {
      await InteractionOnly.onMessage(message);
    } catch (err) {
      Logger.error(
        `[App(Plugin)](Event: ${this.constructor.name}) Error while execute: ${
          (err as Error).message
        }`
      );

      console.error(err);
    }
  }
}
