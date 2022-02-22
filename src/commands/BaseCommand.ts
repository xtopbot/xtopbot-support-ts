import Constants from "../utils/Constants";
import {
  PermissionsString,
  ApplicationCommandData,
  MessageComponentInteraction,
} from "discord.js";
import { UserFlagsPolicy } from "../structures/User";
import CommandMethod from "./CommandMethod";
import Response from "../utils/Response";

export abstract class BaseCommand implements BaseCommandType {
  private data: BaseCommandDataType; // Command data
  public flag: UserFlagsPolicy; // User flag Policy (who can used)
  public memberPermissions: Array<PermissionsString>; // Permissions requirements for a user to access the use of the command
  public botPermissions: Array<PermissionsString>; // The requirements for the bot permission to perform the command
  public applicationCommandData: Array<ApplicationCommandData>;
  public messageComponent: (d: MessageComponentInteraction) => boolean;

  protected constructor(data: BaseCommandDataType) {
    this.data = data;
    this.flag = data.flag;
    this.memberPermissions = data.memberPermissions;
    this.botPermissions = data.botPermissions;
    this.applicationCommandData = data.applicationCommandData;
    this.messageComponent =
      data.messageComponent?.bind(this) ?? this._messageComponent.bind(this);
  }

  public abstract execute(dcm: CommandMethod): Promise<Response>;

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

  private _messageComponent(): boolean {
    return false;
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

interface BaseCommandDataType {
  readonly name?: string | null;
  readonly aliases?: Array<string>;
  readonly flag: UserFlagsPolicy;
  readonly memberPermissions: Array<PermissionsString>;
  readonly botPermissions: Array<PermissionsString>;
  readonly applicationCommandData: Array<ApplicationCommandData>;
  messageComponent?: (d: MessageComponentInteraction) => boolean;
  disableable?: boolean;
  disabled?: boolean;
}

interface BaseCommandType extends BaseCommandDataType {
  readonly applicationCommandOnly: boolean;
  messageComponent: (d: MessageComponentInteraction) => boolean;
  setDisable(): void;
  setEnable(): void;
}
