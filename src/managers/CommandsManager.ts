import Eval from "../commands/admin/Eval";
import type { Command } from "../commands/DefaultCommand";
import { Message, Interaction } from "discord.js";

export default class CommandsManager implements CommandsManagerTypes {
  private readonly commands: Array<Command>;
  constructor() {
    this.commands = [new Eval() as Command];
  }

  public get values(): Array<Command> {
    return this.commands;
  }

  private commandLog(): void {}
}

interface CommandsManagerTypes {
  values: Array<Command>;
}
