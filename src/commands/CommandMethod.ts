import {
  AutocompleteInteraction,
  ButtonInteraction,
  CommandInteraction,
  ContextMenuInteraction,
  DMChannel,
  GuildMember,
  Message,
  NewsChannel,
  NonThreadGuildBasedChannel,
  SelectMenuInteraction,
  TextChannel,
  ThreadChannel,
  User as DiscordUser,
} from "discord.js";
import app from "../app";
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
  public _user: User | null = null;
  private _member: GuildMember | null = null;
  private _channel: TextChannel | NewsChannel | ThreadChannel | null = null;
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
    this._member = this.d.member instanceof GuildMember ? this.d.member : null;
    this._channel =
      this.d.channel instanceof TextChannel ||
      this.d.channel instanceof NewsChannel ||
      this.d.channel instanceof ThreadChannel
        ? this.d.channel
        : null;
  }

  public async fetch(): Promise<void> {
    if (!this._channel) {
      const channel = await this.d.guild?.channels.fetch(this.d.channelId);
      if (
        !channel ||
        !(
          channel instanceof TextChannel ||
          channel instanceof NewsChannel ||
          channel instanceof ThreadChannel
        )
      )
        throw new Exception(
          "Unable to find channel on guild or channel type is not acceptable.",
          Severity.FAULT
        );
      this._channel = channel;
    }
    if (!this._member) {
      const member = await this.d.guild?.members.fetch(this.d.channelId);
      if (!member)
        throw new Exception(
          "Unable to find member on guild.",
          Severity.SUSPICIOUS
        );
      this._member = member;
    }
    if (!this._user)
      // fetch user form our data;
      this._user = await app.users.fetch(this.author);
  }

  public get me(): GuildMember {
    if (!this.d.guild?.me)
      throw new Exception(
        "Unable to find data about bot on guild",
        Severity.FAULT
      );
    return this.d.guild.me;
  }

  get user(): User {
    if (!this._user) throw new Exception("User not fetched.", Severity.FAULT);
    return this._user;
  }

  public get channel(): TextChannel | NewsChannel | ThreadChannel {
    if (!this._channel)
      throw new Exception("Channel not fetched.", Severity.FAULT);
    return this._channel;
  }

  public get member(): GuildMember {
    if (!this._member)
      throw new Exception("Member not fetched.", Severity.FAULT);
    return this._member;
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
