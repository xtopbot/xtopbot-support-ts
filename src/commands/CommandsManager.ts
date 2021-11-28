import { DefaultCommand } from "./DefaultCommand";

export default class CommandsManager {
  private commands: Array<DefaultCommand>;
  private constructor() {
    this.commands = [];
  }
}
