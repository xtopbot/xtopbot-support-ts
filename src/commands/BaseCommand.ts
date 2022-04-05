import Constants from "../utils/Constants";
import {
  PermissionsString,
  ApplicationCommandData,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  SelectMenuInteraction,
  Message,
  ContextMenuCommandInteraction,
  AutocompleteInteraction,
} from "discord.js";
import { UserFlagsPolicy } from "../structures/User";
import CommandMethod, { CommandMethodTypes } from "./CommandMethod";
import Response from "../utils/Response";
import ComponentMethod, { ComponentTypes } from "./ComponentMethod";
import Exception, { Severity } from "../utils/Exception";

export abstract class BaseCommand implements BaseCommandType {
  private data: BaseCommandDataType; // Command data
  public flag: UserFlagsPolicy; // User flag Policy (who can used)
  public memberPermissions: Array<PermissionsString>; // Permissions requirements for a user to access the use of the command
  public botPermissions: Array<PermissionsString>; // The requirements for the bot permission to perform the command
  public applicationCommandData: Array<ApplicationCommandData>;
  public messageComponent: (d: ComponentMethod<ComponentTypes>) => boolean;

  protected constructor(data: BaseCommandDataType) {
    this.data = data;
    this.flag = data.flag;
    this.memberPermissions = data.memberPermissions;
    this.botPermissions = data.botPermissions;
    this.applicationCommandData = data.applicationCommandData;
    this.messageComponent =
      data.messageComponent?.bind(this) ?? this._messageComponent.bind(this);
  }

  public execute(dcm: CommandMethod<CommandMethodTypes>) {
    if (
      dcm.d instanceof AutocompleteInteraction &&
      this.autoCompleteInteraction
    )
      return this.autoCompleteInteraction(
        dcm as CommandMethod<AutocompleteInteraction>
      );
    if (
      dcm.d instanceof ChatInputCommandInteraction &&
      this.chatInputCommandInteraction
    )
      return this.chatInputCommandInteraction(
        dcm as CommandMethod<ChatInputCommandInteraction>
      );
    if (
      dcm.d instanceof ContextMenuCommandInteraction &&
      this.contextMenuCommandInteraction
    )
      return this.contextMenuCommandInteraction(
        dcm as CommandMethod<ContextMenuCommandInteraction>
      );
    if (dcm.d instanceof ModalSubmitInteraction && this.modalSubmitInteraction)
      return this.modalSubmitInteraction(
        dcm as CommandMethod<ModalSubmitInteraction>
      );
    if (dcm.d instanceof ButtonInteraction && this.buttonInteraction)
      return this.buttonInteraction(dcm as CommandMethod<ButtonInteraction>);
    if (dcm.d instanceof SelectMenuInteraction && this.selectMenuInteraction)
      return this.selectMenuInteraction(
        dcm as CommandMethod<SelectMenuInteraction>
      );
    if (dcm.d instanceof Message && this.message)
      return this.message(dcm as CommandMethod<Message>);

    throw new Exception("This interaction is not recognized", Severity.FAULT);
  }

  public autoCompleteInteraction?(
    dcm: CommandMethod<AutocompleteInteraction>
  ): Promise<Response<AutocompleteInteraction>>;
  public chatInputCommandInteraction?(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ): Promise<Response<ChatInputCommandInteraction>>;
  public contextMenuCommandInteraction?(
    dcm: CommandMethod<ContextMenuCommandInteraction>
  ): Promise<Response<ContextMenuCommandInteraction>>;
  public modalSubmitInteraction?(
    dcm: CommandMethod<ModalSubmitInteraction>
  ): Promise<Response<ModalSubmitInteraction>>;
  public buttonInteraction?(
    dcm: CommandMethod<ButtonInteraction>
  ): Promise<Response<ButtonInteraction>>;
  public selectMenuInteraction?(
    dcm: CommandMethod<SelectMenuInteraction>
  ): Promise<Response<SelectMenuInteraction>>;
  public message?(dcm: CommandMethod<Message>): Promise<Response<Message>>;

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
  messageComponent?: (d: ComponentMethod<ComponentTypes>) => boolean;
  disableable?: boolean;
  disabled?: boolean;
}

interface BaseCommandType extends BaseCommandDataType {
  readonly applicationCommandOnly: boolean;
  messageComponent: (d: ComponentMethod<ComponentTypes>) => boolean;
  autoCompleteInteraction?(
    dcm: CommandMethod<AutocompleteInteraction>
  ): Promise<Response<AutocompleteInteraction>>;
  chatInputInteraction?(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ): Promise<Response<ChatInputCommandInteraction>>;
  contextMenuCommandInteraction?(
    dcm: CommandMethod<ContextMenuCommandInteraction>
  ): Promise<Response<ContextMenuCommandInteraction>>;
  modalSubmitInteraction?(
    dcm: CommandMethod<ModalSubmitInteraction>
  ): Promise<Response<ModalSubmitInteraction>>;
  buttonInteraction?(
    dcm: CommandMethod<ButtonInteraction>
  ): Promise<Response<ButtonInteraction>>;
  selectMenuInteraction?(
    dcm: CommandMethod<SelectMenuInteraction>
  ): Promise<Response<SelectMenuInteraction>>;
  message?(dcm: CommandMethod<Message>): Promise<Response<Message>>;
  setDisable(): void;
  setEnable(): void;
}
