import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  ComponentType,
  escapeMarkdown,
  InteractionType,
  ModalSubmitInteraction,
  SelectMenuInteraction,
  TextInputStyle,
} from "discord.js";
import { UserFlagsPolicy } from "../../structures/User";
import { BaseCommand } from "../BaseCommand";
import CommandMethod, { AnyInteraction, Method } from "../CommandMethod";
import app from "../../app";
import Subscription, { PatreonTierId } from "../../structures/Subscription";
import Response, {
  Action,
  MessageResponse,
  ResponseCodes,
} from "../../utils/Response";
import Util from "../../utils/Util";
import CustomBot, { CustomBotStatus } from "../../structures/CustomBot";
import ComponentMethod from "../ComponentMethod";
import Constants from "../../utils/Constants";
import CustomBotsManager from "../../managers/CustomBotsManager";

export default class Subscriptions extends BaseCommand {
  constructor() {
    super({
      flag: UserFlagsPolicy.NONE,
      memberPermissions: [],
      botPermissions: [],
      applicationCommandData: [
        {
          name: "subscriptions",
          description: "Manages your subscriptions",
          type: ApplicationCommandType.ChatInput,
        },
      ],
      messageComponent: (d) => {
        return d.matches("subscription") || d.matches("subscriptions");
      },
    });
  }

  public async chatInputCommandInteraction(
    dcm: CommandMethod<ChatInputCommandInteraction>
  ) {
    const subscription = await app.subscriptions.fetch(
      dcm.user.id,
      PatreonTierId.ONE_CUSTOM_BOT
    );

    if (!subscription)
      return new Response(ResponseCodes.NOT_SUBSCRIBED_YET, {
        ...dcm.locale.origin.commands.subscriptions.notSubscribedYet,
        ephemeral: true,
      });

    return this.manageSubscription(dcm, subscription);
  }

  protected async modalSubmitInteraction(
    dcm: ComponentMethod<ModalSubmitInteraction>
  ) {
    const checker = await this.subscriptionComponentChecker(dcm);
    if (checker instanceof Response) return checker;

    if (checker?.path === "CREATE_CUSTOM_BOT") {
      const customBot = await app.customBots.create(
        dcm.user,
        dcm.d.fields.getTextInputValue("token"),
        checker.subscription.tierId
      );
      dcm.cf.formats.set(
        "bot.tag",
        `${customBot.username}#${customBot.discriminator}`
      );
      dcm.cf.formats.set("bot.shortUUID", Util.getUUIDLowTime(customBot.id));
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...Util.addFieldToEmbed(
            dcm.locale.origin.commands.subscriptions.manage.one.bot.setup
              .completed,
            0,
            "color",
            Constants.defaultColors.GREEN
          ),
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                Util.backButton(
                  dcm.locale,
                  `subscription:tier:${checker.subscription.tierId}`
                ) as any,
                {
                  type: ComponentType.Button,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .setup.completed.buttons[0],
                  style: ButtonStyle.Primary,
                  customId: `subscription:tier:${checker.subscription.tierId}:bots:${customBot.id}`,
                },
              ],
            },
          ],
          ephemeral: true,
        },
        Action.UPDATE
      );
    }
    if (checker?.path === "SUBSCRIPTION_MANAGE")
      return this.manageSubscription(dcm, checker.subscription);
  }

  protected async buttonInteraction(dcm: ComponentMethod<ButtonInteraction>) {
    //Manage single subscription
    const checker = await this.subscriptionComponentChecker(dcm);
    if (checker instanceof Response) return checker;

    if (checker?.path === "CREATE_CUSTOM_BOT")
      return new Response(
        ResponseCodes.SUCCESS,
        {
          title:
            dcm.locale.origin.commands.subscriptions.manage.one.bot.modals[0]
              .title,
          customId: `subscription:tier:${checker.subscription.tierId}:bots:create`,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.TextInput,
                  style: TextInputStyle.Short,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .modals[0].textInput[0].label,
                  placeholder:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .modals[0].textInput[0].placeholder,
                  customId: "token",
                },
              ],
            },
          ],
        },
        Action.MODAL
      );
    else if (checker?.path === "MANAGE_CUSTOM_BOT")
      return this.manageCustomBot(dcm, checker.subscription, checker.target);
    else if (checker?.path === "TERMINATE_CUSTOM_BOT") {
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...Util.addFieldToEmbed(
            dcm.locale.origin.commands.subscriptions.manage.one.bot.terminate,
            0,
            "color",
            Constants.defaultColors.RED
          ),
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Secondary,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .terminate.buttons[0],
                  customId: `subscription:tier:${checker.subscription.tierId}:bots:${checker.target.id}`,
                },
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Danger,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .terminate.buttons[1],
                  customId: `subscription:tier:${checker.subscription.tierId}:bots:${checker.target.id}:terminate!`,
                },
              ],
            },
          ],
          ephemeral: true,
        },
        Action.UPDATE
      );
    } else if (checker?.path === "FORCE_TERMINATE_CUSTOM_BOT") {
      await checker.target.terminate();
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...Util.addFieldToEmbed(
            dcm.locale.origin.commands.subscriptions.manage.one.bot.terminate
              .confirmed,
            0,
            "color",
            Constants.defaultColors.GREEN
          ),
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                Util.backButton(
                  dcm.locale,
                  `subscription:tier:${checker.subscription.tierId}`
                ) as any,
              ],
            },
          ],
          ephemeral: true,
        },
        Action.UPDATE
      );
    } else if (checker?.path === "START_CUSTOM_BOT") {
      const { guilds } = await checker.target.start();
      return this.manageCustomBot(
        dcm,
        checker.subscription,
        checker.target,
        guilds
      );
    } else if (checker?.path === "SUBSCRIPTION_MANAGE")
      return this.manageSubscription(dcm, checker.subscription);
  }

  protected async selectMenuInteraction(
    dcm: ComponentMethod<SelectMenuInteraction>
  ) {
    //Manage single subscription
    const checker = await this.subscriptionComponentChecker(
      dcm,
      dcm.d.values[0]
    );
    if (checker instanceof Response) return checker;

    if (checker?.path === "CREATE_CUSTOM_BOT")
      return new Response(
        ResponseCodes.SUCCESS,
        {
          ...dcm.locale.origin.commands.subscriptions.manage.one.bot.setup,
          components: [
            {
              type: ComponentType.ActionRow,
              components: [
                Util.backButton(
                  dcm.locale,
                  `subscription:tier:${checker.subscription.tierId}`
                ) as any,
                {
                  type: ComponentType.Button,
                  style: ButtonStyle.Primary,
                  customId: `subscription:tier:${checker.subscription.tierId}:bots:create`,
                  label:
                    dcm.locale.origin.commands.subscriptions.manage.one.bot
                      .setup.buttons[1],
                },
              ],
            },
          ],
          ephemeral: true,
        },
        Action.UPDATE
      );
    else if (checker?.path === "MANAGE_CUSTOM_BOT") {
      return this.manageCustomBot(dcm, checker.subscription, checker.target);
    } else if (checker?.path === "LEAVE_SERVERS_CUSTOM_BOT") {
      dcm.d.values.slice(0, 3).map(async (value) => {
        await checker.target.leaveGuild(value, dcm.locale.tag);
      });
      return this.manageCustomBot(dcm, checker.subscription, checker.target);
    } else if (checker?.path === "SUBSCRIPTION_MANAGE")
      return this.manageSubscription(dcm, checker.subscription);
  }

  private async subscriptionComponentChecker(
    dcm: ComponentMethod<any>,
    value?: string
  ): Promise<
    | Response<MessageResponse>
    | {
        subscription: Subscription;
        customBots?: {
          items: CustomBot<"GET">[];
          remaining: number;
        };
        target?: any;
        path:
          | "CREATE_CUSTOM_BOT"
          | "SUBSCRIPTION_MANAGE"
          | "MANAGE_CUSTOM_BOT"
          | "TERMINATE_CUSTOM_BOT"
          | "FORCE_TERMINATE_CUSTOM_BOT"
          | "LEAVE_SERVERS_CUSTOM_BOT"
          | "START_CUSTOM_BOT";
      }
    | void
  > {
    if (dcm.getKey("subscription")) {
      const tierId = dcm.getValue("tier", true);
      if (!Object.values(PatreonTierId).includes(tierId as PatreonTierId))
        return new Response(
          ResponseCodes.UNKNOWN_SUBSCRIPTION_TIER,
          {
            ...dcm.locale.origin.commands.subscriptions.unknownSubscriptionTier,
            ephemeral: true,
          },
          Action.UPDATE
        );

      const subscription = await app.subscriptions.fetch(
        dcm.user.id,
        tierId as PatreonTierId
      );
      if (!subscription)
        return new Response(
          ResponseCodes.NOT_SUBSCRIBED_YET,
          {
            ...dcm.locale.origin.commands.subscriptions.notSubscribedYet,
            ephemeral: true,
          },
          Action.UPDATE
        );

      dcm.cf.formats.set("subscription.tier.name", subscription.getTierName());
      dcm.cf.formats.set(
        "subscription.expiredTimestamp",
        String(Math.round(subscription.getExpires().getTime() / 1000))
      );
      dcm.cf.formats.set(
        "subscription.tier.checkout.url",
        "https://www.patreon.com/join/xtopbot/checkout?rid=" +
          subscription.tierId
      );
      dcm.cf.formats.set(
        "subscription.description",
        dcm.locale.origin.commands.subscriptions.tierDescription[
          subscription.tierId
        ] ?? ""
      );
      if (!subscription.isActive())
        return new Response(
          ResponseCodes.SUBSCRIPTION_EXPIRED,
          {
            ...dcm.locale.origin.commands.subscriptions.subscriptionExpired,
            ephemeral: true,
          },
          Action.UPDATE
        );

      if (dcm.getKey("bots")) {
        const customBots = await app.customBots.fetch(
          dcm.user.id,
          subscription.tierId
        );
        if (dcm.getKey("create") || value === "create") {
          if (customBots.remaining <= 0)
            return new Response(
              ResponseCodes.CREATE_CUSTOM_BOT_LIMIT_REACHED,
              {
                ...dcm.locale.origin.commands.subscriptions
                  .createCustomBotLimitReached,
                ephemeral: true,
              },
              Action.UPDATE
            );
          return {
            subscription,
            customBots,
            path: "CREATE_CUSTOM_BOT",
          };
        }
        const botUUID =
          value && Util.isUUID(value)
            ? value
            : Util.isUUID(dcm.getValue("bots"))
            ? dcm.getValue("bots", true)
            : null;

        const customBot = botUUID
          ? customBots.items.find((cb) => cb.id === botUUID)
          : null;

        if (!customBot)
          return new Response(ResponseCodes.CUSTOM_BOT_NO_LONGER_AVAILABLE, {
            ...dcm.locale.origin.commands.subscriptions.manage.one.bot
              .notLongerAvailable,
            ephemeral: true,
          });

        dcm.cf.formats.set("bot.id", customBot.botId);
        dcm.cf.formats.set("bot.avatar", "");
        dcm.cf.formats.set(
          "bot.tag",
          customBot.username + "#" + customBot.discriminator
        );
        dcm.cf.formats.set("bot.avatar", customBot.getAvatar());
        dcm.cf.formats.set("custom.bot.id", customBot.id);
        dcm.cf.formats.set(
          "custom.bot.id.short",
          Util.getUUIDLowTime(customBot.id)
        );

        if (dcm.getKey("leave")) {
          return {
            subscription,
            customBots,
            target: customBot,
            path: "LEAVE_SERVERS_CUSTOM_BOT",
          };
        }

        if (dcm.getKey("terminate") || dcm.getKey("terminate!")) {
          return {
            subscription,
            customBots,
            target: customBot,
            path: dcm.getKey("terminate!")
              ? "FORCE_TERMINATE_CUSTOM_BOT"
              : "TERMINATE_CUSTOM_BOT",
          };
        }

        if (dcm.getKey("start")) {
          return {
            subscription,
            customBots,
            target: customBot,
            path: "START_CUSTOM_BOT",
          };
        }

        return {
          subscription,
          customBots,
          target: customBot,
          path: "MANAGE_CUSTOM_BOT",
        };
      }
      return {
        subscription,
        path: "SUBSCRIPTION_MANAGE",
      };
    }
  }

  private async manageCustomBot(
    dcm: Method<AnyInteraction>,
    subscription: Subscription,
    customBot: CustomBot<"GET">,
    guilds?: any[]
  ) {
    guilds = guilds ?? (await customBot.fetchGuilds(dcm.locale.tag));
    dcm.cf.formats.set("bot.servers.size", String(guilds.length));
    dcm.cf.formats.set(
      "bot.servers",
      guilds.length > 0
        ? guilds
            .map(
              (guild) =>
                `${escapeMarkdown(Util.textEllipsis(guild.name, 25))} (${
                  guild.id
                })`
            )
            .join(", ")
        : "N/A"
    );
    dcm.cf.formats.set(
      "custom.bot.allowed.servers",
      String(
        CustomBotsManager.getCustomBotAccessServersSizeBySubscriptionTierId(
          subscription.tierId
        )
      )
    );
    dcm.cf.formats.set(
      "custom.bot.status",
      dcm.locale.origin.commands.subscriptions.manage.one.bot.status[
        customBot.getStatus() === CustomBotStatus.STARTED
          ? 0
          : customBot.getStatus() === CustomBotStatus.PROVISIONING
          ? 1
          : customBot.getStatus() === CustomBotStatus.TOKEN_INVALID
          ? 3
          : 2
      ]
    );

    const embeds: any[] = [];
    embeds.push(
      Util.addFieldToEmbed(
        dcm.locale.origin.commands.subscriptions.manage.one.bot,
        0,
        "color",
        customBot.getStatus() === CustomBotStatus.STARTED
          ? Constants.defaultColors.GREEN
          : customBot.getStatus() === CustomBotStatus.PROVISIONING
          ? Constants.defaultColors.ORANGE
          : customBot.getStatus() === CustomBotStatus.OFFLINE
          ? Constants.defaultColors.GRAY
          : Constants.defaultColors.RED
      ).embeds
    );
    if (customBot.getStatus() === CustomBotStatus.TOKEN_INVALID)
      embeds.push(
        Util.addFieldToEmbed(
          dcm.locale.origin.commands.subscriptions.manage.one.bot.invalidToken,
          0,
          "color",
          Constants.defaultColors.RED
        ).embeds
      );
    console.log(guilds);
    return new Response(
      ResponseCodes.SUCCESS,
      {
        embeds: embeds.flat(),
        components: [
          {
            type: ComponentType.ActionRow,
            components: [
              Util.backButton(
                dcm.locale,
                `subscription:tier:${subscription.tierId}`
              ) as any,
              {
                type: ComponentType.Button,
                style: ButtonStyle.Success,
                customId: `subscription:tier:${subscription.tierId}:bots:${customBot.id}:start`,
                label:
                  customBot.getStatus() === CustomBotStatus.STARTED
                    ? dcm.locale.origin.commands.subscriptions.manage.one.bot
                        .buttons[3]
                    : customBot.getStatus() === CustomBotStatus.PROVISIONING
                    ? dcm.locale.origin.commands.subscriptions.manage.one.bot
                        .buttons[2]
                    : dcm.locale.origin.commands.subscriptions.manage.one.bot
                        .buttons[1],
                disabled: customBot.getStatus() !== CustomBotStatus.OFFLINE,
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Danger,
                customId: `subscription:tier:${subscription.tierId}:bots:${customBot.id}:terminate`,
                label:
                  dcm.locale.origin.commands.subscriptions.manage.one.bot
                    .buttons[0],
                disabled:
                  customBot.createdAt.getTime() + 600_000 > Date.now() ??
                  customBot.getStatus() === CustomBotStatus.PROVISIONING,
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Secondary,
                customId: `subscription:tier:${subscription.tierId}:bots:${customBot.id}`,
                label:
                  dcm.locale.origin.commands.subscriptions.manage.one.bot
                    .buttons[4],
              },
              {
                type: ComponentType.Button,
                style: ButtonStyle.Link,
                url: `https://discord.com/oauth2/authorize?client_id=${customBot.botId}&permissions=53865752&scope=bot%20applications.commands`,
                label:
                  dcm.locale.origin.commands.subscriptions.manage.one.bot
                    .buttons[5],
                disabled: guilds.length > 2,
              },
            ],
          },
          (guilds.length > 0
            ? {
                type: ComponentType.ActionRow,
                components: [
                  {
                    type: ComponentType.SelectMenu,
                    customId: `subscription:tier:${subscription.tierId}:bots:${customBot.id}:leave`,
                    placeholder:
                      dcm.locale.origin.commands.subscriptions.manage.one.bot
                        .selectMenu[0].placeholder,
                    options: guilds
                      .map((guild) => ({
                        label: Util.textEllipsis(guild.name, 100),
                        description: guild.id,
                        value: guild.id,
                      }))
                      .slice(0, 25),
                    minValues: 1,
                    maxValues: Math.min(guilds.length, 3),
                  },
                ],
              }
            : null) as any,
        ].filter((c) => c !== null),
        ephemeral: true,
      },
      Action.UPDATE
    );
  }

  private async manageSubscription(
    dcm: Method<AnyInteraction>,
    subscription: Subscription
  ) {
    const customBots = await app.customBots.fetch(
      dcm.user.id,
      subscription.tierId
    );

    const components: any = [
      {
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.Button,
            label:
              dcm.locale.origin.commands.subscriptions.manage.one.buttons[0],
            style: ButtonStyle.Link,
            url: "https://www.patreon.com/join/xtopbot/checkout?edit=1",
          },
          {
            type: ComponentType.Button,
            label:
              dcm.locale.origin.commands.subscriptions.manage.one.buttons[1],
            style: ButtonStyle.Secondary,
            customId: `subscription:tier:${subscription.tierId}`,
          },
        ],
      },
    ];
    const selectMenuCustomBotsOptions = customBots.items.map((cb) => ({
      label: `${cb.username}#${cb.discriminator} (${Util.getUUIDLowTime(
        cb.id
      )})`,
      description:
        dcm.locale.origin.commands.subscriptions.manage.one.selectMenu[0]
          .options[
          cb.getStatus() === CustomBotStatus.STARTED
            ? 1
            : cb.getStatus() === CustomBotStatus.TOKEN_INVALID
            ? 2
            : cb.getStatus() === CustomBotStatus.TOKEN_INVALID
            ? 2
            : 3
        ].description,
      emoji: {
        name:
          cb.getStatus() === CustomBotStatus.STARTED
            ? "🟢"
            : cb.getStatus() === CustomBotStatus.TOKEN_INVALID
            ? "🔴"
            : cb.getStatus() === CustomBotStatus.OFFLINE
            ? "⚫"
            : "🟠",
      },
      value: cb.id,
    }));

    for (let i = 0; i < customBots.remaining; i++) {
      selectMenuCustomBotsOptions.push({
        label: "Bot#0000",
        description:
          dcm.locale.origin.commands.subscriptions.manage.one.selectMenu[0]
            .options[0].description,
        emoji: {
          name: "⚪",
        },
        value: "create",
      });
    }

    if (selectMenuCustomBotsOptions.length > 0)
      components.push({
        type: ComponentType.ActionRow,
        components: [
          {
            type: ComponentType.SelectMenu,
            placeholder:
              dcm.locale.origin.commands.subscriptions.manage.one.selectMenu[0]
                .placeholder,
            customId: `subscription:tier:${subscription.tierId}:bots`,
            options: selectMenuCustomBotsOptions,
            disabled: !subscription.isActive(),
          },
        ],
      });

    dcm.cf.formats.set("subscription.tier.name", subscription.getTierName());
    dcm.cf.formats.set("subscription.id", subscription.getLastEvent("PAID").id);
    dcm.cf.formats.set(
      "subscription.description",
      dcm.locale.origin.commands.subscriptions.tierDescription[
        subscription.tierId
      ] ?? ""
    );
    dcm.cf.formats.set(
      "subscription.createdTimestamp",
      String(Math.round(subscription.getCreatedAt().getTime() / 1000))
    );
    dcm.cf.formats.set(
      "subscription.status",
      subscription.isActive()
        ? dcm.locale.origin.commands.subscriptions.subscriptionStatus.active
        : dcm.locale.origin.commands.subscriptions.subscriptionStatus.expired
    );
    dcm.cf.formats.set(
      "subscription.status.description",
      Util.quickFormatContext(
        subscription.isActive()
          ? dcm.locale.origin.commands.subscriptions.manage.one.status.expires
          : dcm.locale.origin.commands.subscriptions.manage.one.status.expired,
        {
          "subscription.expiresTimestamp": Math.round(
            subscription.getExpires().getTime() / 1000
          ),
        }
      )
    );
    dcm.cf.formats.set(
      "subscription.totalPaid",
      subscription.getTotalPaidAmount(false)
    );
    return new Response(
      ResponseCodes.SUCCESS,
      {
        ...Util.addFieldToEmbed(
          dcm.locale.origin.commands.subscriptions.manage.one,
          0,
          "color",
          subscription.isActive()
            ? Constants.defaultColors.GREEN
            : Constants.defaultColors.GRAY
        ),
        components,
        ephemeral: true,
      },
      [InteractionType.MessageComponent, InteractionType.ModalSubmit].includes(
        dcm.d.type
      )
        ? Action.UPDATE
        : Action.REPLY
    );
  }
}
