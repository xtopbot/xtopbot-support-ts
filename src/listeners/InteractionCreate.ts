import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
  InteractionReplyOptions,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  UserContextMenuCommandInteraction,
} from "discord.js";
import InteractionHandler from "../commands/InteractionHandler";
import Exception from "../utils/Exception";
import Logger from "../utils/Logger";

export default class InteractionCreate {
  static onInteraction: any;
  public static async onInteractionCreate(
    interaction: Interaction
  ): Promise<void> {
    if (interaction.user.bot) return;
    try {
      await InteractionHandler.process(interaction);
    } catch (err) {
      Logger.error(
        `[App](Event: ${this.constructor.name}) Error while execute: ${
          (err as Exception).reason || (err as Error).message
        }`
      );
      console.error(err);
      if (
        err instanceof Exception &&
        err.message &&
        (interaction instanceof ChatInputCommandInteraction ||
          interaction instanceof ButtonInteraction ||
          interaction instanceof SelectMenuInteraction ||
          interaction instanceof MessageContextMenuCommandInteraction ||
          interaction instanceof UserContextMenuCommandInteraction ||
          interaction instanceof ModalSubmitInteraction)
      )
        interaction.reply(err.message as InteractionReplyOptions);
    }
  }
}
