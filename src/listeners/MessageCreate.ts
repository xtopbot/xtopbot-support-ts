import { Message } from "discord.js";
import CommandHandler from "../commands/CommandHandler";

export default class MessageCreate {
  public constructor(message: Message) {
    CommandHandler.onCommand(message);
  }
}
