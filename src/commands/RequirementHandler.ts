import {
  GuildBasedChannel,
  GuildMember,
  NewsChannel,
  PermissionString,
  TextChannel,
  ThreadChannel,
} from "discord.js";
import User from "../structures/User";
import Constants from "../utils/Constants";
import Exception, { Severity } from "../utils/Exception";
import Response, { ResponseCodes } from "../utils/Response";
import Util from "../utils/Util";
import { Command } from "./DefaultCommand";

export default class CommandRequirementsHandler {
  private readonly command: Command;
  private readonly channel:
    | TextChannel
    | NewsChannel
    | ThreadChannel
    | GuildBasedChannel;
  private readonly member: GuildMember;
  private readonly user: User;
  public constructor(
    command: Command,
    channel: TextChannel | NewsChannel | ThreadChannel | GuildBasedChannel,

    member: GuildMember,
    user: User
  ) {
    this.command = command;
    this.channel = channel;
    this.member = member;
    this.user = user;
  }

  public checkAll(): Response | boolean {
    if (!this.userLevelPolicy())
      return new Response(ResponseCodes.UNAUTHORIZED_USER_LEVEL_POLICY, {
        content: "Unauthorized user level policy",
        ephemeral: true,
      });

    if (!this.checkBotChannelPermissions())
      return new Response(ResponseCodes.BOT_CHANNEL_PERMISSIONS_MISSING, {
        content: `The bot permissions for this channel are missing. Please check \`${Util.permissionsToStringArray(
          this.botChannelPermissionsMissing
        ).join(", ")}\`.`,
        ephemeral: true,
      });

    if (!this.checkBotGuildPermissions())
      return new Response(ResponseCodes.BOT_GUILD_PERMISSIONS_MISSING, {
        content: `The bot permissions for this guild are missing. Please check \`${Util.permissionsToStringArray(
          this.botGuildPermissionsMissing
        ).join(", ")}\`.`,
        ephemeral: true,
      });

    if (!this.checkMemberChannelPermissions())
      return new Response(ResponseCodes.MEMBER_CHANNEL_PERMISSIONS_MISSING, {
        content: `Member permissions for this channel are missing. Please check \`${Util.permissionsToStringArray(
          this.memberChannelPermissionsMissing
        ).join(", ")}\` **(requires only one of the permissions listed)**.`,
        ephemeral: true,
      });

    if (!this.checkMemberGuildPermissions())
      return new Response(ResponseCodes.MEMBER_GUILD_PERMISSIONS_MISSING, {
        content: `Member permissions for this guild are missing. Please check \`${Util.permissionsToStringArray(
          this.memberGuildPermissionsMissing
        ).join(", ")}\` **(requires only one of the permissions listed)**.`,
        ephemeral: true,
      });
    return true;
  }

  public userLevelPolicy(): boolean {
    console.log("Command Level: ", this.command.level);
    console.log("User Level: ", this.user.levelPolicy);
    if (this.command.level <= this.user.levelPolicy) return true;
    return false;
  }

  private get me(): GuildMember {
    if (!this.channel.guild.me)
      throw new Exception(
        `[${this.constructor.name}] (me) field is not object cannot handler this.`,
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
      .permissionsFor(this.me)
      .missing(this.botChannelPermissions);
  }

  public checkBotChannelPermissions(): boolean {
    return this.botChannelPermissions.length
      ? this.channel.permissionsFor(this.me).has(this.botChannelPermissions)
      : true;
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
    return this.me.permissions.missing(this.botGuildPermissions);
  }

  public checkBotGuildPermissions(): boolean {
    return this.botGuildPermissions.length
      ? this.me.permissions.has(this.botGuildPermissions)
      : true;
  }

  /**
   * Member Channel Permissions (Requires one of permissions)
   */

  private get memberChannelPermissions(): Array<PermissionString> {
    return this.command.memberPermissions.filter((permission) =>
      Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get memberChannelPermissionsMissing(): Array<PermissionString> {
    return this.channel
      .permissionsFor(this.member)
      .missing(this.memberChannelPermissions);
  }

  public checkMemberChannelPermissions(): boolean {
    return this.memberChannelPermissions.length
      ? this.channel
          .permissionsFor(this.member)
          .any(this.memberChannelPermissions)
      : true;
  }

  /**
   * Member Guild Permissions (Requires one of permissions)
   */

  private get memberGuildPermissions(): Array<PermissionString> {
    return this.command.memberPermissions.filter(
      (permission) => !Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get memberGuildPermissionsMissing(): Array<PermissionString> {
    return this.member.permissions.missing(this.memberGuildPermissions);
  }

  public checkMemberGuildPermissions(): boolean {
    return this.memberGuildPermissions.length
      ? this.member.permissions.any(this.memberGuildPermissions)
      : true;
  }
}
