import {
  AutocompleteInteraction,
  ButtonInteraction,
  ChannelType,
  ChatInputCommandInteraction,
  DMChannel,
  GuildMember,
  Message,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  NewsChannel,
  SelectMenuInteraction,
  TextChannel,
  ThreadChannel,
  User as DiscordUser,
  UserContextMenuCommandInteraction,
  VoiceChannel,
} from "discord.js";
import app from "../app";
import User from "../structures/User";
import ContextFormats from "../utils/ContextFormats";
import Exception, { Severity } from "../utils/Exception";
import CommandHandler from "./CommandHandler";
import { BaseCommand } from "./BaseCommand";
import ComponentMethod, { AnyComponentInteraction } from "./ComponentMethod";
import Constants from "../utils/Constants";

export default class CommandMethod<T extends CommandMethodTypes> {
  public readonly d: T;
  public readonly command: BaseCommand;
  public readonly cf: ContextFormats = new ContextFormats();
  private _user: User | null = null;
  private _member: GuildMember | null = null;
  private _channel:
    | TextChannel
    | NewsChannel
    | ThreadChannel
    | VoiceChannel
    | null = null;

  constructor(d: T, command: BaseCommand) {
    this.d = d;
    this.command = command;
    this._member = this.d.member instanceof GuildMember ? this.d.member : null;
    this._channel =
      this.d.channel instanceof TextChannel ||
      this.d.channel instanceof NewsChannel ||
      this.d.channel instanceof ThreadChannel ||
      this.d.channel instanceof VoiceChannel
        ? this.d.channel
        : null;
  }

  public async fetch(): Promise<void> {
    if (this.d.guild && !this._channel && this.d.channelId) {
      const channel = await this.d.guild?.channels.fetch(this.d.channelId);
      if (
        !channel ||
        !(
          channel instanceof TextChannel ||
          channel instanceof NewsChannel ||
          channel instanceof ThreadChannel ||
          channel instanceof VoiceChannel ||
          channel instanceof VoiceChannel
        )
      )
        throw new Exception(
          "Unable to find channel on guild or channel type is not acceptable.",
          Severity.FAULT
        );
      this._channel = channel;
    }
    // fetch user form our data;
    if (!this._user)
      this._user = await app.users.fetch(
        this.author,
        !(this.d instanceof AutocompleteInteraction)
      );

    if (!this._member) {
      const member = await (
        this.d.guild ?? app.client.guilds.cache.get(Constants.supportServerId)
      )?.members.fetch({ user: this.user.id, force: true });
      if (!member) {
        if (!this.d.guild)
          throw new Exception(
            this.locale.origin.requirement.notInOurSupportServer,
            Severity.COMMON
          );
        throw new Exception(
          "Unable to find member on guild.",
          Severity.SUSPICIOUS
        );
      }
      this._member = member;
    }
  }

  public get me(): GuildMember {
    const me =
      this.d.guild?.members.me ??
      app.client.guilds.cache.get(Constants.supportServerId)?.members.me;
    if (!me)
      throw new Exception(
        "Unable to find data about bot on guild",
        Severity.FAULT
      );
    return me;
  }

  get user(): User {
    if (!this._user) throw new Exception("User not fetched.", Severity.FAULT);
    return this._user;
  }

  public get channel():
    | TextChannel
    | NewsChannel
    | ThreadChannel
    | VoiceChannel {
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

  public get locale() {
    return app.locales.get(this.user.locale) || app.locales.get(null);
  }

  public isComponentInteraction(): this is ComponentMethod<
    ModalSubmitInteraction & ButtonInteraction & SelectMenuInteraction
  >;
  public isComponentInteraction() {
    return (
      this.d instanceof ButtonInteraction ||
      this.d instanceof SelectMenuInteraction ||
      this.d instanceof ModalSubmitInteraction
    );
  }
}
export type AnyInteraction =
  | ChatInputCommandInteraction
  | ButtonInteraction
  | SelectMenuInteraction
  | UserContextMenuCommandInteraction
  | MessageContextMenuCommandInteraction
  | AutocompleteInteraction
  | ModalSubmitInteraction;
export type CommandMethodTypes = Message | AnyInteraction;

export type AnyMethod =
  | ComponentMethod<AnyComponentInteraction>
  | CommandMethod<CommandMethodTypes>;

export type Method<T extends CommandMethodTypes> = T extends Message
  ? CommandMethod<Message>
  : T extends ChatInputCommandInteraction
  ? CommandMethod<ChatInputCommandInteraction>
  : T extends UserContextMenuCommandInteraction
  ? CommandMethod<UserContextMenuCommandInteraction>
  : T extends MessageContextMenuCommandInteraction
  ? CommandMethod<MessageContextMenuCommandInteraction>
  : T extends AutocompleteInteraction
  ? CommandMethod<AutocompleteInteraction>
  : T extends ButtonInteraction
  ? ComponentMethod<ButtonInteraction>
  : T extends SelectMenuInteraction
  ? ComponentMethod<SelectMenuInteraction>
  : T extends ModalSubmitInteraction
  ? ComponentMethod<ModalSubmitInteraction>
  : never;
