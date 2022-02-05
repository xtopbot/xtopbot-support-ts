import {
  ButtonInteraction,
  SelectMenuInteraction,
  ContextMenuCommandInteraction,
  AutocompleteInteraction,
  Interaction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  MessageComponentInteraction,
  ChatInputCommandInteraction,
  ApplicationCommandType,
} from "discord.js";
import { Command } from "./DefaultCommand";
import app from "../app";
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
        d instanceof ChatInputCommandInteraction ||
        d instanceof ContextMenuCommandInteraction ||
        d instanceof ButtonInteraction ||
        d instanceof SelectMenuInteraction ||
        d instanceof AutocompleteInteraction
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
      d instanceof ChatInputCommandInteraction ||
      d instanceof ContextMenuCommandInteraction ||
      d instanceof AutocompleteInteraction
    ) {
      return app.commands.getApplicationCommand(
        d.commandName +
          (d instanceof ContextMenuCommandInteraction
            ? ""
            : " " +
              (d.options.getSubcommandGroup(false) ?? "" ?? " ") +
              (d.options.getSubcommand(false) ?? "")
          ).trim(),
        d instanceof UserContextMenuCommandInteraction
          ? ApplicationCommandType.User
          : d instanceof MessageContextMenuCommandInteraction
          ? ApplicationCommandType.Message
          : ApplicationCommandType.ChatInput
      );
    } else if (d instanceof MessageComponentInteraction) {
      return app.commands.getMessageComponentCommand(d);
    }
    throw new Exception(Reason.INTERACTION_TYPE_NOT_DETECT, Severity.FAULT);
  }
}
