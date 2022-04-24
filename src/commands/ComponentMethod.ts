import {
  ButtonInteraction,
  ModalSubmitInteraction,
  SelectMenuInteraction,
} from "discord.js";
import Exception, { Severity } from "../utils/Exception";
import { BaseCommand } from "./BaseCommand";
import CommandMethod from "./CommandMethod";

export default class ComponentMethod<
  T extends ComponentTypes
> extends CommandMethod<T> {
  public readonly customId: string[];
  public path: string = "";
  constructor(d: T, command: BaseCommand) {
    super(d, command);
    this.customId = this.d.customId.split(":");
  }

  public matches(value: string): boolean {
    const customIdAt0 = this.customId?.at(0);
    if (customIdAt0 === value || customIdAt0 === value.substring(0, 4))
      return true;
    return false;
  }

  public getValue(value: string, required: boolean = true): string {
    const findIndex = this.customId?.findIndex(
      (customId) => customId.toLowerCase() === value.toLowerCase()
    );
    if (findIndex === -1 && required)
      throw new Exception("Custom Id invalid.", Severity.FAULT, this.command);
    return findIndex === -1 ? "" : this.customId?.at(findIndex + 1) ?? "";
  }

  public setPath(value: string): void {
    this.path = value;
  }
}

export type ComponentTypes =
  | ButtonInteraction
  | SelectMenuInteraction
  | ModalSubmitInteraction;
