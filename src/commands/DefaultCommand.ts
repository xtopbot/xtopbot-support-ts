import Constants from "../utils/Constants";
import type { PermissionString, ApplicationCommandData } from "discord.js";
import { UserLevelPolicy } from "../structures/User";

export class DefaultCommand implements DefaultCommandType {
  data: DefaultCommandDataType; // Command data
  level: UserLevelPolicy; // User Level Policy (who can used)
  userPermissions: Array<PermissionString>; // Permissions requirements for a user to access the use of the command
  botPermissions: Array<PermissionString>; // The requirements for the bot permission to perform the command
  applicationCommandData: Array<ApplicationCommandData>;

  protected constructor(data: DefaultCommandDataType) {
    this.data = data;
    this.level = data.level;
    this.userPermissions = data.userPermissions;
    this.botPermissions = data.botPermissions;
    this.applicationCommandData = data.applicationCommandData;
  }

  public get name(): string | null {
    return this.data.name ?? null;
  }

  public get aliases(): Array<string> {
    return this.data.aliases ?? [];
  }

  public get applicationCommandOnly(): boolean {
    return !this.name;
  }

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
  readonly name?: string | null;
  readonly aliases?: Array<string>;
  readonly level: UserLevelPolicy;
  readonly userPermissions: Array<PermissionString>;
  readonly botPermissions: Array<PermissionString>;
  readonly applicationCommandData: Array<ApplicationCommandData>;
  disableable?: boolean;
  disabled?: boolean;
}

interface DefaultCommandType extends DefaultCommandDataType {
  readonly applicationCommandOnly: boolean;
  setDisable(): void;
  setEnable(): void;
}

enum RunType {
  APPLICATION_COMMAND,
  COMMAND,
}
