import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  ContextMenuInteraction,
  Message,
  SelectMenuInteraction,
} from "discord.js";
import ContextFormat from "../utils/ContextFormat";
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
  private replied: boolean = false;
  constructor(
    d:
      | Message
      | CommandInteraction
      | ButtonInteraction
      | SelectMenuInteraction
      | ContextMenuInteraction
      | AutocompleteInteraction,
    command: Command
  ) {
    this.d = d;
    this.command = command;
  }

  public get context(): string {
    if (!(this.d instanceof Message)) throw new Error("oppsss...");
    return this.d.content.replace(
      CommandHandler.regexMatches(this.command),
      ""
    );
  }

  /*reply(context: any): void {
    if (this.replied) return;
    this.replied = true;
    if (this.d instanceof Message) {
        this.d.channel.send(context);
    } else if (this.d instanceof CommandInteraction) {
        this.d.reply(context);
    }
  }*/
}
