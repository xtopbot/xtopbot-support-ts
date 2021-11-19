import { Client } from "discord.js";
import * as dotenv from "dotenv";
dotenv.config();
/*
client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "ping") {
    await interaction.reply("Pong!");
  }
});*/

class XtopBotSupport extends Client {
  constructor() {
    super({
      intents: [
        "GUILDS",
        "GUILD_MEMBERS",
        "GUILD_BANS",
        "GUILD_EMOJIS_AND_STICKERS",
        "GUILD_INTEGRATIONS",
        "GUILD_VOICE_STATES",
        "GUILD_PRESENCES",
        "GUILD_MESSAGES",
        "GUILD_MESSAGE_REACTIONS",
        "GUILD_MESSAGE_TYPING",
      ],
    });
    this.login(process.env.DISCORD_BOT_TOKEN);
  }

  private listeern() {}

  public static run() {
    //this.login(process.env.DISCORD_BOT_TOKEN);
  }
}
