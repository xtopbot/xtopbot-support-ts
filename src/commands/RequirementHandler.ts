import { GuildMember, PermissionString } from "discord.js";
import Constants from "../utils/Constants";
import Exception, { Reason, Severity } from "../utils/Exception";
import Response, { ResponseCodes } from "../utils/Response";
import Util from "../utils/Util";
import CommandMethod from "./CommandMethod";

export default class CommandRequirementsHandler {
  private readonly dcm: CommandMethod;
  public constructor(dcm: CommandMethod) {
    this.dcm = dcm;
  }

  public async checkAll(): Promise<boolean | Response> {
    if (!this.userLevelPolicy())
      return new Response(ResponseCodes.UNAUTHORIZED_USER_LEVEL_POLICY, {
        content: "Unauthorized user level policy",
        ephemeral: true,
      });
    if (this.dcm.d.inGuild()) {
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
    }
    return true;
  }

  public userLevelPolicy(): boolean {
    if (this.dcm.command.level <= this.dcm.user.levelPolicy) return true;
    return false;
  }

  private get me(): GuildMember {
    if (!this.dcm.d.guild?.me)
      throw new Exception(
        Reason.SOMETHING_WAS_WRONG_WHILE_CHECKING_REQUIREMENTS_COMMAND,
        Severity.FAULT
      );
    return this.dcm.d.guild.me;
  }

  /**
   * Bot Channel Permissions (Requires All permissions)
   */

  private get botChannelPermissions(): Array<PermissionString> {
    return this.dcm.command.botPermissions.filter((permission) =>
      Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get botChannelPermissionsMissing(): Array<PermissionString> {
    return this.dcm.channel
      .permissionsFor(this.me)
      .missing(this.botChannelPermissions);
  }

  public checkBotChannelPermissions(): boolean {
    return this.botChannelPermissions.length
      ? this.dcm.channel.permissionsFor(this.me).has(this.botChannelPermissions)
      : true;
  }

  /**
   * Bot Guild Permissions (Requires All permissions)
   */

  private get botGuildPermissions(): Array<PermissionString> {
    return this.dcm.command.botPermissions.filter(
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
    return this.dcm.command.memberPermissions.filter((permission) =>
      Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get memberChannelPermissionsMissing(): Array<PermissionString> {
    return this.dcm.channel
      .permissionsFor(this.dcm.member)
      .missing(this.memberChannelPermissions);
  }

  public checkMemberChannelPermissions(): boolean {
    return this.memberChannelPermissions.length
      ? this.dcm.channel
          .permissionsFor(this.dcm.member)
          .any(this.memberChannelPermissions)
      : true;
  }

  /**
   * Member Guild Permissions (Requires one of permissions)
   */

  private get memberGuildPermissions(): Array<PermissionString> {
    return this.dcm.command.memberPermissions.filter(
      (permission) => !Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get memberGuildPermissionsMissing(): Array<PermissionString> {
    return this.dcm.member.permissions.missing(this.memberGuildPermissions);
  }

  public checkMemberGuildPermissions(): boolean {
    return this.memberGuildPermissions.length
      ? this.dcm.member.permissions.any(this.memberGuildPermissions)
      : true;
  }
}
