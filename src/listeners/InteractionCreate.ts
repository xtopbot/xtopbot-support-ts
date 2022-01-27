import {
  AutocompleteInteraction,
  BaseCommandInteraction,
  ButtonInteraction,
  CommandInteraction,
  ContextMenuInteraction,
  Interaction,
  MessageComponentInteraction,
  SelectMenuInteraction,
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
          (err as Error | Exception).message
        }`
      );
      console.error(err);
      if (
        err instanceof Exception &&
        err.message &&
        interaction instanceof
          (CommandInteraction ||
            ButtonInteraction ||
            SelectMenuInteraction ||
            ContextMenuInteraction)
      )
        interaction.reply(err.message);
    }
  }
}
