import Eval from "./admin/Eval";
import type { DefaultCommand } from "./DefaultCommand";
import { Message, Interaction } from "discord.js";
import CommandHandler from "./CommandHandler";
import InteractionHandler from "./InteractionHandler";

export default class CommandsManager implements CommandsManagerTypes {
  public commands: Array<DefaultCommand>;
  constructor() {
    this.commands = [new Eval()];
  }

  public onMessageCreate(d: Message): void {
    CommandHandler.onCommand(d);
  }

  public onInteractionCreate(d: Interaction): void {
    InteractionHandler.onInteraction(d);
  }

  private commandLog(): void {}
}

interface CommandsManagerTypes {
  commands: Array<DefaultCommand>;
  onMessageCreate(d: Message): void;
  onInteractionCreate(d: Interaction): void;
}
