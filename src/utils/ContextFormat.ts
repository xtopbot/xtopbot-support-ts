import { Collection } from "discord.js";
import Locale from "../structures/Locale";

export default class ContextFormat {
  public formats: Collection<string, string | number> = new Collection();
  constructor() {}
}
