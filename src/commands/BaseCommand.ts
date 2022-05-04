import Constants from "../utils/Constants";
import {
  PermissionsString,
  ApplicationCommandData,
  ModalSubmitInteraction,
  ChatInputCommandInteraction,
  ButtonInteraction,
  SelectMenuInteraction,
  Message,
  AutocompleteInteraction,
  UserContextMenuCommandInteraction,
  MessageContextMenuCommandInteraction,
} from "discord.js";
import { UserFlagsPolicy } from "../structures/User";
import CommandMethod, { CommandMethodTypes, Method } from "./CommandMethod";
import Response, {
  AutocompleteResponse,
  MessageResponse,
  ModalResponse,
} from "../utils/Response";
import ComponentMethod, { AnyComponentInteraction } from "./ComponentMethod";
import Exception, { Severity } from "../utils/Exception";

export abstract class BaseCommand implements BaseCommandType {
  private data: BaseCommandDataType; // Command data
  public flag: UserFlagsPolicy; // User flag Policy (who can used)
  public memberPermissions: Array<PermissionsString>; // Permissions requirements for a user to access the use of the command
  public botPermissions: Array<PermissionsString>; // The requirements for the bot permission to perform the command
  public applicationCommandData: Array<ApplicationCommandData>;
  public messageComponent: (
    d: ComponentMethod<AnyComponentInteraction>
  ) => boolean;

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
      dcm.d instanceof UserContextMenuCommandInteraction &&
      this.userContextMenuCommandInteraction
    )
      return this.userContextMenuCommandInteraction(
        dcm as CommandMethod<UserContextMenuCommandInteraction>
      );
    if (
      dcm.d instanceof MessageContextMenuCommandInteraction &&
      this.messageContextMenuCommandInteraction
    )
      return this.messageContextMenuCommandInteraction(
        dcm as CommandMethod<MessageContextMenuCommandInteraction>
      );
    if (dcm.d instanceof ModalSubmitInteraction && this.modalSubmitInteraction)
      return this.modalSubmitInteraction(
        dcm as ComponentMethod<ModalSubmitInteraction>
      );
    if (dcm.d instanceof ButtonInteraction && this.buttonInteraction)
      return this.buttonInteraction(dcm as ComponentMethod<ButtonInteraction>);
    if (dcm.d instanceof SelectMenuInteraction && this.selectMenuInteraction)
      return this.selectMenuInteraction(
        dcm as ComponentMethod<SelectMenuInteraction>
      );
    if (dcm.d instanceof Message && this.message)
      return this.message(dcm as CommandMethod<Message>);

    throw new Exception("This interaction is not recognized", Severity.FAULT);
  }

  public autoCompleteInteraction?(
    dcm: CommandMethod<AutocompleteInteraction>
  ): Promise<Response<AutocompleteResponse>>;
  public chatInputCommandInteraction?(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  public userContextMenuCommandInteraction?(
    dcm: CommandMethod<UserContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  public messageContextMenuCommandInteraction?(
    dcm: CommandMethod<MessageContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  public modalSubmitInteraction?(
    dcm: CommandMethod<ModalSubmitInteraction>
  ): Promise<Response<MessageResponse>>;
  public buttonInteraction?(
    dcm: CommandMethod<ButtonInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  public selectMenuInteraction?(
    dcm: CommandMethod<SelectMenuInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  public message?(
    dcm: CommandMethod<Message>
  ): Promise<Response<MessageResponse | null>>;

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
  messageComponent?: (d: ComponentMethod<AnyComponentInteraction>) => boolean;
  disableable?: boolean;
  disabled?: boolean;
}

interface BaseCommandType extends BaseCommandDataType {
  readonly applicationCommandOnly: boolean;
  messageComponent: (d: ComponentMethod<AnyComponentInteraction>) => boolean;
  autoCompleteInteraction?(
    dcm: Method<AutocompleteInteraction>
  ): Promise<Response<AutocompleteResponse>>;
  chatInputInteraction?(
    dcm: Method<ChatInputCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  userContextMenuCommandInteraction?(
    dcm: Method<UserContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  messageContextMenuCommandInteraction?(
    dcm: Method<MessageContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  modalSubmitInteraction?(
    dcm: Method<ModalSubmitInteraction>
  ): Promise<Response<MessageResponse>>;
  buttonInteraction?(
    dcm: Method<ButtonInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  selectMenuInteraction?(
    dcm: Method<SelectMenuInteraction>
  ): Promise<Response<MessageResponse | ModalResponse>>;
  message?(dcm: Method<Message>): Promise<Response<MessageResponse | null>>;
  setDisable(): void;
  setEnable(): void;
}
