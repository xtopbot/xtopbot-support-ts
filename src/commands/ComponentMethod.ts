import {
  ButtonInteraction,
  ModalSubmitInteraction,
  SelectMenuInteraction,
} from "discord.js";
import Exception, { Severity } from "../utils/Exception";
import { BaseCommand } from "./BaseCommand";
import CommandMethod from "./CommandMethod";

export default class ComponentMethod<
  T extends AnyComponentInteraction
> extends CommandMethod<T> {
  public readonly customIds: string[];
  public path: string = "";
  constructor(d: T, command: BaseCommand) {
    super(d, command);
    this.customIds = this.d.customId.split(":");
  }

  public matches(value: string): boolean {
    const customIdAt0 = this.customIds?.at(0);
    if (customIdAt0 === value || customIdAt0 === value.substring(0, 4))
      return true;
    return false;
  }
  public getValue(value: string, required?: true): string;
  public getValue(value: string, required: false): string | null;
  public getValue(value: string, required: boolean = true): string | null {
    const findIndex = this.customIds?.findIndex(
      (customId) => customId.toLowerCase() === value.toLowerCase()
    );
    if (findIndex === -1 && required)
      throw new Exception("Custom Id invalid.", Severity.FAULT, this.command);
    return findIndex === -1 ? null : this.customIds?.at(findIndex + 1) ?? "";
  }

  public getKey(value: string): boolean {
    return !!this.customIds?.find(
      (customId) => customId.toLowerCase() === value.toLowerCase()
    );
  }

  public isFollowUp(): boolean {
    return !!this.getValue("followUp", false);
  }
}

export type AnyComponentInteraction =
  | ButtonInteraction
  | SelectMenuInteraction
  | ModalSubmitInteraction;
