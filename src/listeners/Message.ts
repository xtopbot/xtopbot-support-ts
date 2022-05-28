import { Message, PartialMessage } from "discord.js";
import CommandHandler from "../commands/CommandHandler";
import AuditLog from "../plugins/AuditLog";
import InteractionOnly from "../plugins/InteractionOnly";
import RequestHumanAssistant from "../plugins/RequestHumanAssistant";
import Logger from "../utils/Logger";

export default class message {
  public static async onMessageCreate(message: Message): Promise<void> {
    await CommandHandler.process(message).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: MessageCreate (CommandHandler)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
    await InteractionOnly.onMessage(message).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: MessageCreate (InteractionOnly)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
    await RequestHumanAssistant.onMessageInThread(message).catch(
      (err: unknown) =>
        Logger.error(
          err,
          `[App](Event: MessageCreate (RequestHumanAssistant)) Error while execute: ${
            (err as Error)?.message
          }`
        )
    );
  }

  public static async onMessageDelete(message: Message | PartialMessage) {
    await AuditLog.messageDelete(message).catch((err: unknown) =>
      Logger.error(
        err,
        `[App](Event: MessageDelete (AuditLog)) Error while execute: ${
          (err as Error)?.message
        }`
      )
    );
  }
}
