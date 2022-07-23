import { BaseCommand } from "../commands/BaseCommand";
import Eval from "../commands/admin/Eval";
import Notifications from "../commands/user/Notifications";
import WebhookMessage from "../commands/admin/WebhookMessage";
import WebhookCreate from "../commands/admin/WebhookCreate";
import HelpDesk from "../commands/help/Helpdesk";
import Languages from "../commands/user/Languages";
import RequestAssistant from "../commands/user/RequestAssistant";

export default class CommandsManager implements CommandsManagerTypes {
  private declare readonly commands: Array<BaseCommand>;
  constructor() {
    this.commands = [
      new Eval(),
      new Notifications(),
      new WebhookMessage(),
      new WebhookCreate(),
      new HelpDesk(),
      new Languages(),
      new RequestAssistant(),
    ];
  }

  public get values(): Array<BaseCommand> {
    return this.commands;
  }
}

interface CommandsManagerTypes {
  values: Array<BaseCommand>;
}
