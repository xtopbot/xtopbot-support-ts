import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  ContextMenuInteraction,
  Message,
  SelectMenuInteraction,
  User as DiscordUser,
} from "discord.js";
import User from "../structures/User";
import ContextFormat from "../utils/ContextFormat";
import Exception, { Severity } from "../utils/Exception";
import CommandHandler from "./CommandHandler";
import { Command } from "./DefaultCommand";

export default class CommandMethod {
  public readonly d:
    | Message
    | CommandInteraction
    | ButtonInteraction
    | SelectMenuInteraction
    | ContextMenuInteraction
    | AutocompleteInteraction;
  public readonly command: Command;
  private readonly cf: ContextFormat = new ContextFormat();
  public readonly user: User;
  constructor(
    d:
      | Message
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction
      | ContextMenuInteraction
      | AutocompleteInteraction,
    command: Command,
    user: User
  ) {
    this.d = d;
    this.command = command;
    this.user = user;
  }

  public get author(): DiscordUser {
    if (this.d instanceof Message) return this.d.author;
    return this.d.user;
  }

  public get context(): string {
    if (!(this.d instanceof Message))
      throw new Exception("oppsss...", Severity.FAULT);
    return this.d.content
      .replace(CommandHandler.regexMatches(this.command), "")
      .trim();
  }
}

export interface MessageCommandMethod extends CommandMethod {
  d: Message;
}
export interface CommandInteractionMethod extends CommandMethod {
  d: CommandInteraction;
}
export interface ButtonInteractionMethod extends CommandMethod {
  d: ButtonInteraction;
}
export interface SelectMenuInteractionMethod extends CommandMethod {
  d: SelectMenuInteraction;
}
export interface ContextMenuInteractionMethod extends CommandMethod {
  d: ContextMenuInteraction;
}
export interface AutocompleteInteractionMethod extends CommandMethod {
  d: AutocompleteInteraction;
}
