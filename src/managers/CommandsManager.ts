import type { Command } from "../commands/DefaultCommand";
import Eval from "../commands/admin/Eval";
import Notifications from "../commands/user/Notifications";

export default class CommandsManager implements CommandsManagerTypes {
  private readonly commands: Array<Command>;
  constructor() {
    this.commands = [new Eval() as Command, new Notifications() as Command];
  }

  public get values(): Array<Command> {
    return this.commands;
  }
}

interface CommandsManagerTypes {
  values: Array<Command>;
}
