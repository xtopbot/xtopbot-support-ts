import {
  ButtonInteraction,
  SelectMenuInteraction,
  AutocompleteInteraction,
  Interaction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
  ChatInputCommandInteraction,
  ApplicationCommandType,
  ModalSubmitInteraction,
} from "discord.js";
import { BaseCommand } from "./BaseCommand";
import app from "../app";
import Exception, { Reason, Severity } from "../utils/Exception";
import CommandHandler from "./CommandHandler";
import ComponentMethod from "./ComponentMethod";
import CommandMethod from "./CommandMethod";
export default class InteractionHandler {
  public static process(d: Interaction) {
    const command: BaseCommand | null = this.getCommand(d);
    if (!command)
      throw new Exception(
        Reason.UNABLE_TO_FIND_INTERACTION_COMMAND,
        Severity.SUSPICIOUS
      );
    if (
      d instanceof ButtonInteraction ||
      d instanceof SelectMenuInteraction ||
      d instanceof ModalSubmitInteraction
    )
      return CommandHandler.executeHandler(new ComponentMethod(d, command));
    if (
      d instanceof ChatInputCommandInteraction ||
      d instanceof UserContextMenuCommandInteraction ||
      d instanceof MessageContextMenuCommandInteraction ||
      d instanceof AutocompleteInteraction
    )
      return CommandHandler.executeHandler(new CommandMethod(d, command));
    throw new Exception(
      Reason.INTERACTION_TYPE_NOT_DETECT,
      Severity.SUSPICIOUS
    );
  }

  private static getCommand(d: Interaction): BaseCommand | null {
    if (
      d instanceof ChatInputCommandInteraction ||
      d instanceof UserContextMenuCommandInteraction ||
      d instanceof MessageContextMenuCommandInteraction ||
      d instanceof AutocompleteInteraction
    ) {
      return app.commands.getApplicationCommand(
        (
          d.commandName +
          (d instanceof UserContextMenuCommandInteraction ||
          d instanceof MessageContextMenuCommandInteraction
            ? ""
            : " " +
              (d.options.getSubcommandGroup(false) ?? "" ?? " ") +
              (d.options.getSubcommand(false) ?? ""))
        ).trim(),
        d instanceof UserContextMenuCommandInteraction
          ? ApplicationCommandType.User
          : d instanceof MessageContextMenuCommandInteraction
          ? ApplicationCommandType.Message
          : ApplicationCommandType.ChatInput
      );
    } else if (
      d instanceof ButtonInteraction ||
      d instanceof SelectMenuInteraction ||
      d instanceof ModalSubmitInteraction
    ) {
      return app.commands.getCommadFromComponent(d);
    }
    throw new Exception(Reason.INTERACTION_TYPE_NOT_DETECT, Severity.FAULT);
  }
}
