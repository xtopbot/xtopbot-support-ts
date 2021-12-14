import {
  GuildMember,
  NewsChannel,
  PermissionString,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import app from "../app";
import User from "../structures/User";
import Constants from "../utils/Constants";
import Exception, { Severity } from "../utils/Exception";
import FinalResponse, { FinalResponseCode } from "../utils/FinalResponse";
import Util from "../utils/Util";
import { DefaultCommand } from "./DefaultCommand";

export default class CommandRequirementsHandler {
  private readonly command: DefaultCommand;
  private readonly channel: TextChannel | NewsChannel | ThreadChannel;
  private readonly member: GuildMember;
  private readonly user: User;
  public constructor(
    command: DefaultCommand,
    channel: TextChannel | NewsChannel | ThreadChannel,

    member: GuildMember,
    user: User
  ) {
    this.command = command;
    this.channel = channel;
    this.member = member;
    this.user = user;
  }

  public all(): FinalResponse | boolean {
    if (!this.userLevelPolicy())
      return new FinalResponse(
        FinalResponseCode.UNAUTHORIZED_USER_LEVEL_POLICY,
        {
          content: "Unauthorized user level policy",
        }
      );
    if (!this.checkBotChannelPermissions())
      return new FinalResponse(
        FinalResponseCode.BOT_CHANNEL_PERMISSIONS_MISSING,
        {
          content: `The bot permissions in this channel are missing. Please check \`${Util.permissionsToStringArray(
            this.botChannelPermissionsMissing
          ).join(", ")}\`.`,
        }
      );
    if (!this.checkBotGuildPermissions())
      return new FinalResponse(
        FinalResponseCode.BOT_GUILD_PERMISSIONS_MISSING,
        {
          content: `The bot permissions in this guild are missing. Please check \`${Util.permissionsToStringArray(
            this.botGuildPermissionsMissing
          ).join(", ")}\`.`,
        }
      );
    return true;
  }

  public userLevelPolicy(): boolean {
    return false;
  }

  private get me(): GuildMember {
    if (!this.channel.guild.me)
      throw new Exception(
        "[CommandRequirementsHandler] (me) field is not object.",
        Severity.FAULT
      );
    return this.channel.guild.me;
  }

  /**
   * Bot Channel Permissions (Requires All permissions)
   */

  private get botChannelPermissions(): Array<PermissionString> {
    return this.command.botPermissions.filter((permission) =>
      Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get botChannelPermissionsMissing(): Array<PermissionString> {
    return this.channel
      .permissionsFor(this.member.guild.me as GuildMember)
      .missing(this.botChannelPermissions);
  }

  public checkBotChannelPermissions(): boolean {
    return this.channel
      .permissionsFor(this.member.guild.me)
      .has(this.botChannelPermissions);
  }

  /**
   * Bot Guild Permissions (Requires All permissions)
   */

  private get botGuildPermissions(): Array<PermissionString> {
    return this.command.botPermissions.filter(
      (permission) => !Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get botGuildPermissionsMissing(): Array<PermissionString> {
    return this.channel.guild.me.permissions.missing(this.botGuildPermissions);
  }

  public checkBotGuildPermissions(): boolean {
    return this.channel
      .permissionsFor(this.member.guild.me as GuildMember)
      .has(this.botGuildPermissions);
  }
}
