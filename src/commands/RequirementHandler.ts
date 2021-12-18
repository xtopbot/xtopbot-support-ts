import {
  GuildMember,
  NewsChannel,
  PermissionString,
  TextChannel,
  ThreadChannel,
} from "discord.js";
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

  public checkAll(): FinalResponse | boolean {
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
          content: `The bot permissions for this channel are missing. Please check \`${Util.permissionsToStringArray(
            this.botChannelPermissionsMissing
          ).join(", ")}\`.`,
        }
      );

    if (!this.checkBotGuildPermissions())
      return new FinalResponse(
        FinalResponseCode.BOT_GUILD_PERMISSIONS_MISSING,
        {
          content: `The bot permissions for this guild are missing. Please check \`${Util.permissionsToStringArray(
            this.botGuildPermissionsMissing
          ).join(", ")}\`.`,
        }
      );

    if (!this.checkMemberChannelPermissions())
      return new FinalResponse(
        FinalResponseCode.MEMBER_CHANNEL_PERMISSIONS_MISSING,
        {
          content: `Member permissions for this channel are missing. Please check \`${Util.permissionsToStringArray(
            this.memberChannelPermissionsMissing
          ).join(", ")}\` **(requires only one of the permissions listed)**.`,
        }
      );

    if (!this.checkMemberGuildPermissions())
      return new FinalResponse(
        FinalResponseCode.MEMBER_GUILD_PERMISSIONS_MISSING,
        {
          content: `Member permissions for this guild are missing. Please check \`${Util.permissionsToStringArray(
            this.memberGuildPermissionsMissing
          ).join(", ")}\` **(requires only one of the permissions listed)**.`,
        }
      );
    return true;
  }

  public userLevelPolicy(): boolean {
    if (this.command.level > this.user.levelPolicy) return false;
    return true;
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
    return this.channel.permissionsFor(this.me).has(this.botChannelPermissions);
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
    return this.me.permissions.has(this.botGuildPermissions);
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
    return this.channel
      .permissionsFor(this.member)
      .any(this.memberChannelPermissions);
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
    return this.member.permissions.any(this.memberGuildPermissions);
  }
}
