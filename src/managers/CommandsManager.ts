import { BaseCommand } from "../commands/DefaultCommand";
import Eval from "../commands/admin/Eval";
import Notifications from "../commands/user/Notifications";

export default class CommandsManager implements CommandsManagerTypes {
  private readonly commands: Array<BaseCommand>;
  constructor() {
    this.commands = [
      new Eval() as BaseCommand,
      new Notifications() as BaseCommand,
    ];
  }

  public get values(): Array<BaseCommand> {
    return this.commands;
  }
}

interface CommandsManagerTypes {
  values: Array<BaseCommand>;
}
