import { Client } from "discord.js";
import InteractionHandler from "../commands/InteractionHandler";
import MessageCreate from "./MessageCreate";

export default class ListenersHandler {
  public static handler(client: Client) {
    client.on("messageCreate", MessageCreate.bind(this));
    client.on("interactionCreate", InteractionHandler.onInteraction.bind(this));
  }
}
