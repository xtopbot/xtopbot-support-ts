import Constants from "../utils/Constants";
import type { PermissionString, ApplicationCommandData } from "discord.js";
import { UserLevelPolicy } from "../structures/User";
import CommandMethod from "./CommandMethod";
import FinalResponse from "../utils/Response";

export class DefaultCommand implements DefaultCommandType {
  private data: DefaultCommandDataType; // Command data
  public level: UserLevelPolicy; // User Level Policy (who can used)
  public memberPermissions: Array<PermissionString>; // Permissions requirements for a user to access the use of the command
  public botPermissions: Array<PermissionString>; // The requirements for the bot permission to perform the command
  public applicationCommandData: Array<ApplicationCommandData>;

  protected constructor(data: DefaultCommandDataType) {
    this.data = data;
    this.level = data.level;
    this.memberPermissions = data.memberPermissions;
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
  readonly memberPermissions: Array<PermissionString>;
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

export interface Command extends DefaultCommand {
  execute(dcm: CommandMethod): Promise<FinalResponse>;
}

enum ExecuteType {
  APPLICATION_COMMAND,
  COMMAND,
}
