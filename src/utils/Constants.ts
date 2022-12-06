import { PermissionsString, ChannelType } from "discord.js";
import { LocaleTag } from "../managers/LocaleManager";
import { UserFlagsPolicy } from "../structures/User";
import app from "../app";
export default class Constants {
  public static readonly SLASH_EMOJI: string = "<:slash:984557412801478658>";
  public static readonly DEFAULT_LOCALE: LocaleTag = "en-US";
  public static readonly DEFAULT_COMMAND_DISABLEABLE_VALUE: boolean = true;
  public static readonly DEFAULT_COMMAND_DISABLED_VALUE: boolean = false;
  public static readonly REGEX_SNOWFLAKE = /^\d{17,18}$/;
  public static readonly WEBHOOKS_CHANNEL_TYPES: ChannelType[] = [
    ChannelType.GuildText,
    ChannelType.GuildNews,
  ];
  public static readonly defaultColors = {
    RED: 12008772,
    ORANGE: 16089632,
    GREEN: 5151559,
    GRAY: 3355443,
    BLUE: 1340892,
    EMBED_GRAY: 3092790,
    PLEDGOR: 16289587,
  };
  public static readonly DEFAULT_INTERACTION_EXPIRES: number =
    1000 /*MiliSecond*/ * 60 /*Minute*/ * 15; //ms
  public static readonly StaffBitwise =
    UserFlagsPolicy.SUPPORT |
    UserFlagsPolicy.MODERATOR |
    UserFlagsPolicy.ADMIN |
    UserFlagsPolicy.DEVELOPER;

  public static readonly DEFAULT_PREFIX: string = "!";
  public static readonly supportServerId = process.argv.find(
    (arg) => arg === "--production"
  )
    ? "664657102551121961"
    : "884642692980690975";

  public static readonly CHANNEL_PERMISSIONS: Array<PermissionsString> = [
    "ManageChannels",
    "ViewChannel",
    "CreateInstantInvite",
    //Text Channel Only
    "ManageWebhooks",
    "AddReactions",
    "SendMessages",
    "SendTTSMessages",
    "ManageMessages",
    "EmbedLinks",
    "AttachFiles",
    "ReadMessageHistory",
    "MentionEveryone",
    "UseExternalEmojis",
    "UseApplicationCommands",
    "ManageThreads",
    "SendMessagesInThreads",
    "CreatePublicThreads",
    "CreatePrivateThreads",
    "UseExternalStickers",
    //Voice Channel Only
    "Stream",
    "Connect",
    "Speak",
    "MuteMembers",
    "DeafenMembers",
    "UseVAD",
    "MoveMembers",
    "RequestToSpeak",
    "PrioritySpeaker",
  ];
}
