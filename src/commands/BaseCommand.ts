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
  AnyResponse,
  AutocompleteResponse,
  MessageResponse,
  ModalResponse,
  ResponseCodes,
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

  public async execute(
    dcm: CommandMethod<CommandMethodTypes>
  ): Promise<Response<AnyResponse>> {
    let response = null;
    if (
      dcm.d instanceof AutocompleteInteraction &&
      this.autoCompleteInteraction
    ) {
      response =
        (await this.autoCompleteInteraction(
          dcm as CommandMethod<AutocompleteInteraction>
        )) ?? null;
    } else if (
      dcm.d instanceof ChatInputCommandInteraction &&
      this.chatInputCommandInteraction
    ) {
      response =
        (await this.chatInputCommandInteraction(
          dcm as CommandMethod<ChatInputCommandInteraction>
        )) ?? null;
    } else if (
      dcm.d instanceof UserContextMenuCommandInteraction &&
      this.userContextMenuCommandInteraction
    ) {
      response =
        (await this.userContextMenuCommandInteraction(
          dcm as CommandMethod<UserContextMenuCommandInteraction>
        )) ?? null;
    } else if (
      dcm.d instanceof MessageContextMenuCommandInteraction &&
      this.messageContextMenuCommandInteraction
    ) {
      response =
        (await this.messageContextMenuCommandInteraction(
          dcm as CommandMethod<MessageContextMenuCommandInteraction>
        )) ?? null;
    } else if (
      dcm.d instanceof ModalSubmitInteraction &&
      this.modalSubmitInteraction
    ) {
      response =
        (await this.modalSubmitInteraction(
          dcm as ComponentMethod<ModalSubmitInteraction>
        )) ?? null;
    } else if (dcm.d instanceof ButtonInteraction && this.buttonInteraction) {
      response =
        (await this.buttonInteraction(
          dcm as ComponentMethod<ButtonInteraction>
        )) ?? null;
    } else if (
      dcm.d instanceof SelectMenuInteraction &&
      this.selectMenuInteraction
    ) {
      response =
        (await this.selectMenuInteraction(
          dcm as ComponentMethod<SelectMenuInteraction>
        )) ?? null;
    } else if (dcm.d instanceof Message && this.message) {
      response = (await this.message(dcm as CommandMethod<Message>)) ?? null;
    } else
      throw new Exception("This interaction is not recognized", Severity.FAULT);

    if (response === null)
      throw new Exception(
        dcm.d instanceof ButtonInteraction ||
        dcm.d instanceof SelectMenuInteraction ||
        dcm.d instanceof ModalSubmitInteraction
          ? "Unknown Custom Id"
          : "Unknown Argument",
        Severity.FAULT,
        dcm
      );

    return response;
  }

  public autoCompleteInteraction?(
    dcm: CommandMethod<AutocompleteInteraction>
  ): Promise<Response<AutocompleteResponse> | void>;
  public chatInputCommandInteraction?(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  public userContextMenuCommandInteraction?(
    dcm: CommandMethod<UserContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  public messageContextMenuCommandInteraction?(
    dcm: CommandMethod<MessageContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  public modalSubmitInteraction?(
    dcm: CommandMethod<ModalSubmitInteraction>
  ): Promise<Response<MessageResponse> | void>;
  public buttonInteraction?(
    dcm: CommandMethod<ButtonInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  public selectMenuInteraction?(
    dcm: CommandMethod<SelectMenuInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
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
  ): Promise<Response<AutocompleteResponse> | void>;
  chatInputInteraction?(
    dcm: Method<ChatInputCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  userContextMenuCommandInteraction?(
    dcm: Method<UserContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  messageContextMenuCommandInteraction?(
    dcm: Method<MessageContextMenuCommandInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  modalSubmitInteraction?(
    dcm: Method<ModalSubmitInteraction>
  ): Promise<Response<MessageResponse> | void>;
  buttonInteraction?(
    dcm: Method<ButtonInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  selectMenuInteraction?(
    dcm: Method<SelectMenuInteraction>
  ): Promise<Response<MessageResponse | ModalResponse> | void>;
  message?(dcm: Method<Message>): Promise<Response<MessageResponse | null>>;
  setDisable(): void;
  setEnable(): void;
}
