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

export default class {
  public readonly d:
    | Message
    | CommandInteraction
    | ButtonInteraction
    | SelectMenuInteraction
    | ContextMenuInteraction
    | AutocompleteInteraction;
  private readonly command: Command;
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
