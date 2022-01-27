import {
  ButtonInteraction,
  SelectMenuInteraction,
  CommandInteraction,
  ContextMenuInteraction,
  AutocompleteInteraction,
  Interaction,
} from "discord.js";
import { Command } from "./DefaultCommand";
import app from "../app";
import { ApplicationCommandTypes } from "discord.js/typings/enums";
import Exception, { Reason, Severity } from "../utils/Exception";
import CommandHandler from "./CommandHandler";
export default class InteractionHandler {
  public static process(d: Interaction) {
    const command: Command | null = this.getCommand(d);
    if (!command)
      throw new Exception(
        Reason.UNABLE_TO_FIND_INTERACTION_COMMAND,
        Severity.SUSPICIOUS
      );
    if (
      !(
        d instanceof
        (CommandInteraction ||
          ContextMenuInteraction ||
          ButtonInteraction ||
          SelectMenuInteraction ||
          AutocompleteInteraction)
      )
    )
      throw new Exception(
        Reason.INTERACTION_TYPE_NOT_DETECT,
        Severity.SUSPICIOUS
      );
    return CommandHandler.executeHandler(d, command);
  }

  private static getCommand(d: Interaction): Command | null {
    if (
      d instanceof
      (CommandInteraction || ContextMenuInteraction || AutocompleteInteraction)
    ) {
      return app.commands.getApplicationCommand(
        (
          d.commandName +
          " " +
          (d.options.getSubcommandGroup(false) ?? "" ?? " ") +
          (d.options.getSubcommand(false) ?? "")
        ).trim(),
        ApplicationCommandTypes.CHAT_INPUT
      );
    } else if (d instanceof (ButtonInteraction || SelectMenuInteraction)) {
      return app.commands.getMessageComponentCommand(d.customId);
    }
    throw new Exception(Reason.INTERACTION_TYPE_NOT_DETECT, Severity.FAULT);
  }
}
