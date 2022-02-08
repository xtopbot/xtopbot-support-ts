import { BaseCommand } from "../commands/BaseCommand";
import Eval from "../commands/admin/Eval";
import Notifications from "../commands/user/Notifications";
import WebhookMessage from "../commands/admin/WebhookMessage";
import WebhookCreate from "../commands/admin/WebhookCreate";

export default class CommandsManager implements CommandsManagerTypes {
  private readonly commands: Array<BaseCommand>;
  constructor() {
    this.commands = [
      new Eval(),
      new Notifications(),
      new WebhookMessage(),
      new WebhookCreate(),
    ];
  }

  public get values(): Array<BaseCommand> {
    return this.commands;
  }
}

interface CommandsManagerTypes {
  values: Array<BaseCommand>;
}
