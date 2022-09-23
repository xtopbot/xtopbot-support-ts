import { ChannelType, Client, TextChannel } from "discord.js";
import Logger from "../utils/Logger";
import app from "../app";

export default class Ready {
  public static onReady(client: Client) {
    Logger.info(`[Discord] <${client?.user?.tag}>Bot connected!`);

    /**
     * Setup Helpdesk Schedule
     */
    Logger.info("Setup helpdesk channels...");
    client.guilds.cache.forEach((guild) => {
      app.locales.cache.forEach((locale) => {
        let channel = guild.channels.cache.find(
          (channel) =>
            channel.name.toLowerCase() ===
              locale.origin.helpdeskChannel.toLowerCase() &&
            channel.type === ChannelType.GuildText
        );
        if (!channel) return;
        Logger.info(
          `Server[${guild.name}(${guild.id})] Helpdesk[${channel.name}(${channel.id})] Scheduled For Language ${locale.tag}`
        );
        app.articles.setHelpdeskSchedule(channel as TextChannel, locale);
      });
    });
  }
}
