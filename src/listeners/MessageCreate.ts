import { Message } from "discord.js";
import CommandHandler from "../commands/CommandHandler";

export default class MessageCreate {
  public static async onMessageCreate(message: Message) {
    try {
      await CommandHandler.onCommand(message);
    } catch (err) {
      console.log(err);
    }
  }
}
