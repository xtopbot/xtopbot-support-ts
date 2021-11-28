import Constants from "../utils/Constants";
import type { PermissionString, ApplicationCommandData } from "discord.js";
import { Message, Interaction } from "discord.js";

export class DefaultCommand implements DefaultCommandType {
  data: DefaultCommandDataType; // Command data
  name: string; // Command Name
  aliases: Array<string>; // Command Aliases
  level: CommandLevels; // Command Level (who can used)
  userPermissions: Array<PermissionString>; // Permissions requirements for a user to access the use of the command
  botPermissions: Array<PermissionString>; // The requirements for the bot permission to perform the command
  applicationCommandData: Array<ApplicationCommandData>;

  protected constructor(data: DefaultCommandDataType) {
    this.data = data;
    this.name = data.name;
    this.aliases = data.aliases;
    this.level = data.level;
    this.userPermissions = data.userPermissions;
    this.botPermissions = data.botPermissions;
  }

  public run(data: Message | Interaction): void {
    if (data.channel.type == "DM") return;
    if (data instanceof Message) {
      if (!data.channel.permissionsFor(data.member).has(this.userPermissions))
        return;
    } else if (data instanceof Interaction) {
      if (!data.memberPermissions.has(this.userPermissions)) return;
    }
  }

  // If command can be disabled
  public get disableable(): boolean {
    return typeof this.data.disableable === "boolean"
      ? this.data.disableable
      : Constants.DEFAULT_COMMAND_DISABLEABLE_VALUE;
  }

  public get disabled(): boolean {
    return typeof this.data.disabled === "boolean"
      ? this.data.disabled
      : Constants.DEFAULT_COMMAND_DISABLED_VALUE;
  }

  public setDisable(): void {
    if (!this.disableable) throw new Error("This command cannot be disabled");
    this.data.disabled = true;
  }

  public setEnable(): void {
    if (!this.disabled) throw new Error("This command not disabled");
    this.data.disabled = false;
  }
}

interface DefaultCommandDataType {
  readonly name: string;
  readonly aliases: Array<string>;
  readonly level: CommandLevels;
  readonly userPermissions: Array<PermissionString>;
  readonly botPermissions: Array<PermissionString>;
  readonly applicationCommandData: Array<ApplicationCommandData>;
  disableable?: boolean;
  disabled?: boolean;
}

interface DefaultCommandType extends DefaultCommandDataType {
  run(data: Message | Interaction): void;
  setDisable(): void;
  setEnable(): void;
}

enum RunType {
  APPLICATION_COMMAND,
  COMMAND,
}

export enum CommandLevels {
  DEVELOPER = 5,
  ADMIN = 4,
  STAFF = 3,
  SUPPORT = 2,
  EVERYONE = 1,
}
