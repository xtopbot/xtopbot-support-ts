import { PermissionsString } from "discord.js";
import Constants from "../utils/Constants";
import Response, { Action, ResponseCodes } from "../utils/Response";
import Util from "../utils/Util";
import CommandMethod, { CommandMethodTypes } from "./CommandMethod";
import Locale from "../structures/Locale";

export default class CommandRequirementsHandler {
  private readonly dcm: CommandMethod<CommandMethodTypes>;

  public constructor(dcm: CommandMethod<CommandMethodTypes>) {
    this.dcm = dcm;
  }

  public async checkAll(): Promise<void> {
    let message = {
      embeds: [
        {
          color: Constants.defaultColors.RED,
        },
      ],
    };
    if (!this.dcm.command.isDMAllowed())
      throw new Response(
        ResponseCodes.COMMAND_DM_NOT_ALLOWED,
        {
          ...Util.addFieldToEmbed(
            message,
            0,
            "description",
            this.dcm.locale.origin.requirement.dmNotAllowed
          ),
          ephemeral: true,
        },
        Action.REPLY
      );
    if (!this.userFlagPolicy())
      throw new Response(
        ResponseCodes.INSUFFICIENT_PERMISSION,
        {
          ...Util.addFieldToEmbed(
            message,
            0,
            "description",
            this.dcm.locale.origin.requirement.insufficientPermission
          ),
          ephemeral: true,
        },
        Action.REPLY
      );
    if (this.dcm.d.inGuild()) {
      if (!this.checkBotChannelPermissions())
        throw new Response(
          ResponseCodes.BOT_CHANNEL_PERMISSIONS_MISSING,
          {
            ...Util.quickFormatContext(
              Util.addFieldToEmbed(
                message,
                0,
                "description",
                this.dcm.locale.origin.requirement.botChannelPermissionsMissing
              ),
              {
                "bot.channel.permissions.missing":
                  Util.permissionsToStringArray(
                    this.botChannelPermissionsMissing
                  ).join(", "),
              }
            ),
            ephemeral: true,
          },
          Action.REPLY
        );

      if (!this.checkBotGuildPermissions())
        throw new Response(
          ResponseCodes.BOT_GUILD_PERMISSIONS_MISSING,
          {
            ...Util.quickFormatContext(
              Util.addFieldToEmbed(
                message,
                0,
                "description",
                this.dcm.locale.origin.requirement.botGuildPermissionsMissing
              ),
              {
                "bot.guild.permissions.missing": Util.permissionsToStringArray(
                  this.botGuildPermissionsMissing
                ).join(", "),
              }
            ),
            ephemeral: true,
          },
          Action.REPLY
        );

      if (!this.checkMemberChannelPermissions())
        throw new Response(
          ResponseCodes.MEMBER_CHANNEL_PERMISSIONS_MISSING,
          {
            ...Util.quickFormatContext(
              Util.addFieldToEmbed(
                message,
                0,
                "description",
                this.dcm.locale.origin.requirement
                  .memberChannelPermissionsMissing
              ),
              {
                "member.channel.permissions.missing":
                  Util.permissionsToStringArray(
                    this.memberChannelPermissionsMissing
                  ).join(", "),
              }
            ),
            ephemeral: true,
          },
          Action.REPLY
        );

      if (!this.checkMemberGuildPermissions())
        throw new Response(
          ResponseCodes.MEMBER_GUILD_PERMISSIONS_MISSING,
          {
            ...Util.quickFormatContext(
              Util.addFieldToEmbed(
                message,
                0,
                "description",
                this.dcm.locale.origin.requirement.memberGuildPermissionsMissing
              ),
              {
                "member.guild.permissions.missing":
                  Util.permissionsToStringArray(
                    this.memberGuildPermissionsMissing
                  ).join(", "),
              }
            ),
            ephemeral: true,
          },
          Action.REPLY
        );
    }
  }

  public userFlagPolicy(): boolean {
    return (
      this.dcm.command.flag === 0 ||
      (this.dcm.user.flags & this.dcm.command.flag) !== 0
    );
  }

  /**
   * Bot Channel Permissions (Requires All permissions)
   */

  private get botChannelPermissions(): Array<PermissionsString> {
    return this.dcm.command.botPermissions.filter((permission) =>
      Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get botChannelPermissionsMissing(): Array<PermissionsString> {
    return this.dcm.channel
      .permissionsFor(this.dcm.me)
      .missing(this.botChannelPermissions);
  }

  public checkBotChannelPermissions(): boolean {
    return this.botChannelPermissions.length
      ? this.dcm.channel
          .permissionsFor(this.dcm.me)
          .has(this.botChannelPermissions)
      : true;
  }

  /**
   * Bot Guild Permissions (Requires All permissions)
   */

  private get botGuildPermissions(): Array<PermissionsString> {
    return this.dcm.command.botPermissions.filter(
      (permission) => !Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get botGuildPermissionsMissing(): Array<PermissionsString> {
    return this.dcm.me.permissions.missing(this.botGuildPermissions);
  }

  public checkBotGuildPermissions(): boolean {
    return this.botGuildPermissions.length
      ? this.dcm.me.permissions.has(this.botGuildPermissions)
      : true;
  }

  /**
   * Member Channel Permissions (Requires one of permissions)
   */

  private get memberChannelPermissions(): Array<PermissionsString> {
    return this.dcm.command.memberPermissions.filter((permission) =>
      Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get memberChannelPermissionsMissing(): Array<PermissionsString> {
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

  private get memberGuildPermissions(): Array<PermissionsString> {
    return this.dcm.command.memberPermissions.filter(
      (permission) => !Constants.CHANNEL_PERMISSIONS.includes(permission)
    );
  }

  private get memberGuildPermissionsMissing(): Array<PermissionsString> {
    return this.dcm.member.permissions.missing(this.memberGuildPermissions);
  }

  public checkMemberGuildPermissions(): boolean {
    return this.memberGuildPermissions.length
      ? this.dcm.member.permissions.any(this.memberGuildPermissions)
      : true;
  }

  public static insufficientPermissionMessage(locale: Locale) {
    return {
      embeds: [
        {
          color: Constants.defaultColors.RED,
          description: locale.origin.requirement.insufficientPermission,
        },
      ],
    };
  }
}
